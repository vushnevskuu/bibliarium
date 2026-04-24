import type { Link } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { buildLinkAiProfileAsync } from "@/lib/ai-taste/build-link-profile";
import {
  analyzeImageStructured,
  type RawVisualAnalysis,
} from "@/lib/ai-taste/analyze-image";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { normalizeUrlString } from "@/lib/url-parse";

const MAX_PASTE_TEXT = 50_000;
const MAX_IMAGE_BYTES = 2_500_000;

function firstLineTitle(text: string, max = 200): string {
  const line = text.trim().split(/\r?\n/)[0] ?? "";
  const t = line.trim();
  if (!t) return "Заметка";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function clipBase(): string {
  return getSiteUrl().replace(/\/$/, "");
}

export type SaveClipboardResult =
  | { ok: true; status: 201; link: Link }
  | { ok: false; status: number; error: string; fieldErrors?: unknown };

type SaveInput = {
  userId: string;
  collectionId?: string | null;
  openaiApiKey?: string | null;
};

export async function savePastedTextForUser(
  input: SaveInput & { text: string }
): Promise<SaveClipboardResult> {
  const { userId, collectionId, openaiApiKey, text: raw } = input;
  const text = raw.replace(/\0/g, "").trim();
  if (!text) {
    return { ok: false, status: 400, error: "Пустой текст" };
  }
  if (text.length > MAX_PASTE_TEXT) {
    return {
      ok: false,
      status: 400,
      error: `Текст длиннее ${MAX_PASTE_TEXT} символов`,
    };
  }

  if (collectionId) {
    const col = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });
    if (!col) {
      return { ok: false, status: 400, error: "Collection not found" };
    }
  }

  const sortAgg = await prisma.link.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (sortAgg._max.sortOrder ?? 0) + 1;

  const id = randomUUID();
  const url = `${clipBase()}/l/${id}`;
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrlString(url);
  } catch {
    return { ok: false, status: 400, error: "Invalid site URL" };
  }

  const title = firstLineTitle(text);
  const description =
    text.length > 500 ? `${text.slice(0, 499)}…` : text || null;

  const aiProfile = await buildLinkAiProfileAsync(
    {
      normalizedUrl,
      url,
      canonicalUrl: null,
      title,
      description,
      domain: "заметка",
      provider: "clipboard",
      previewType: "fallback",
      imageUrl: null,
      faviconUrl: null,
      siteName: "Буфер обмена",
      author: null,
      publishedAt: null,
      extractedText: text,
      userNote: null,
    },
    openaiApiKey
  );

  const tagsJson = JSON.stringify([]);

  const link = await prisma.link.create({
    data: {
      id,
      sortOrder: nextSortOrder,
      url,
      normalizedUrl,
      title,
      description,
      imageUrl: null,
      faviconUrl: null,
      siteName: "Буфер обмена",
      domain: "заметка",
      provider: "clipboard",
      previewType: "fallback",
      embedHtml: null,
      embedUrl: null,
      oEmbedJson: null,
      tagsJson,
      collectionId: collectionId ?? undefined,
      userId,
      note: null,
      extractedText: text,
      aiProfileJson: JSON.stringify(aiProfile),
      ingestionStatus: "complete",
    },
  });

  return { ok: true, status: 201, link };
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([\w/+.-]+);base64,([\s\S]+)$/i.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2].replace(/\s/g, "") };
}

export async function savePastedImageDataUrlForUser(
  input: SaveInput & { dataUrl: string }
): Promise<SaveClipboardResult> {
  const { userId, collectionId, openaiApiKey, dataUrl: raw } = input;
  const trimmed = raw.trim();
  const parsed = parseDataUrl(trimmed);
  if (!parsed) {
    return { ok: false, status: 400, error: "Ожидается data:URL (base64)" };
  }
  const allowed = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ]);
  if (!allowed.has(parsed.mime)) {
    return {
      ok: false,
      status: 400,
      error: "Допустимы только PNG, JPEG, WebP, GIF",
    };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(parsed.base64, "base64");
  } catch {
    return { ok: false, status: 400, error: "Некорректная base64" };
  }
  if (buf.length === 0) {
    return { ok: false, status: 400, error: "Пустой файл" };
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 400,
      error: `Изображение больше ${Math.round(MAX_IMAGE_BYTES / 1_000_000)} МБ`,
    };
  }

  if (collectionId) {
    const col = await prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });
    if (!col) {
      return { ok: false, status: 400, error: "Collection not found" };
    }
  }

  const sortAgg = await prisma.link.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (sortAgg._max.sortOrder ?? 0) + 1;

  const id = randomUUID();
  const url = `${clipBase()}/l/${id}`;
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrlString(url);
  } catch {
    return { ok: false, status: 400, error: "Invalid site URL" };
  }

  const dataUrl = trimmed;

  let visualProfile: RawVisualAnalysis | null = null;
  let visionDescription: string | null = null;
  if (dataUrl) {
    visualProfile = await analyzeImageStructured(dataUrl, openaiApiKey);
    if (visualProfile) {
      visionDescription = [
        visualProfile.depicted,
        visualProfile.execution_read,
        visualProfile.non_subject_attraction,
        visualProfile.visual_attraction,
        visualProfile.stylistic_signals?.join(", "),
        visualProfile.emotional_tone?.join(", "),
        visualProfile.color_profile?.description,
      ]
        .filter(Boolean)
        .join(". ");
    }
  }

  const titleFromVision =
    visualProfile?.depicted?.trim().slice(0, 120) || null;
  const title = titleFromVision || "Изображение из буфера";

  const aiProfile = await buildLinkAiProfileAsync(
    {
      normalizedUrl,
      url,
      canonicalUrl: null,
      title,
      description: null,
      domain: "изображение",
      provider: "image",
      previewType: "image",
      imageUrl: dataUrl,
      faviconUrl: null,
      siteName: "Буфер обмена",
      author: null,
      publishedAt: null,
      extractedText: null,
      oEmbedAuthor: null,
      visionDescription,
      visualProfile,
      userNote: null,
    },
    openaiApiKey
  );

  const tagsJson = JSON.stringify([]);

  const link = await prisma.link.create({
    data: {
      id,
      sortOrder: nextSortOrder,
      url,
      normalizedUrl,
      title,
      description: null,
      imageUrl: dataUrl,
      faviconUrl: null,
      siteName: "Буфер обмена",
      domain: "изображение",
      provider: "image",
      previewType: "image",
      embedHtml: null,
      embedUrl: null,
      oEmbedJson: null,
      tagsJson,
      collectionId: collectionId ?? undefined,
      userId,
      note: null,
      extractedText: null,
      aiProfileJson: JSON.stringify(aiProfile),
      ingestionStatus: "complete",
    },
  });

  return { ok: true, status: 201, link };
}
