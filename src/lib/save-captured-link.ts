import type { Link } from "@prisma/client";
import { buildLinkAiProfile } from "@/lib/ai-taste/build-link-profile";
import { extractMainTextFromUrl } from "@/lib/ai-taste/extract-main-text";
import { prisma } from "@/lib/prisma";
import { resolvePreview } from "@/lib/preview-resolver";
import { normalizeUrlString } from "@/lib/url-parse";
import { assertUrlSafeForFetch } from "@/lib/url-security";

export type SaveCapturedLinkInput = {
  userId: string;
  rawUrl: string;
  collectionId?: string | null;
  note?: string | null;
  tags?: string[];
  /** Tab / extension hints — applied when preview omits them */
  titleHint?: string | null;
  faviconHint?: string | null;
};

export type SaveCapturedLinkResult =
  | { ok: true; status: 201; link: Link }
  | {
      ok: true;
      status: 409;
      duplicate: true;
      link: Link;
    }
  | { ok: false; status: number; error: string; fieldErrors?: unknown };

export async function saveCapturedLinkForUser(
  input: SaveCapturedLinkInput
): Promise<SaveCapturedLinkResult> {
  const { userId, rawUrl, collectionId, note, tags, titleHint, faviconHint } =
    input;

  try {
    assertUrlSafeForFetch(
      /^https?:\/\//i.test(rawUrl.trim())
        ? rawUrl.trim()
        : `https://${rawUrl.trim()}`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid URL";
    return { ok: false, status: 400, error: msg };
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrlString(rawUrl);
  } catch {
    return { ok: false, status: 400, error: "Invalid URL" };
  }

  const existing = await prisma.link.findUnique({
    where: { userId_normalizedUrl: { userId, normalizedUrl } },
  });
  if (existing) {
    return {
      ok: true,
      status: 409,
      duplicate: true,
      link: existing,
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

  let preview;
  try {
    preview = await resolvePreview(rawUrl);
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Could not fetch a preview for this URL";
    return { ok: false, status: 422, error: msg };
  }

  const title =
    (preview.title?.trim() ? preview.title : null) ??
    (titleHint?.trim() ? titleHint.trim() : null);
  const faviconUrl = preview.faviconUrl ?? faviconHint ?? null;

  let extractedText: string | null = null;
  if (preview.provider === "article" || preview.provider === "web") {
    extractedText = await extractMainTextFromUrl(
      preview.normalizedUrl,
      12000,
      10_000
    );
  }

  const oa =
    preview.oEmbedJson &&
    typeof preview.oEmbedJson.author_name === "string"
      ? preview.oEmbedJson.author_name
      : null;

  const aiProfile = buildLinkAiProfile({
    normalizedUrl: preview.normalizedUrl,
    url: preview.url,
    canonicalUrl: null,
    title,
    description: preview.description,
    domain: preview.domain,
    provider: preview.provider,
    previewType: preview.previewType,
    imageUrl: preview.imageUrl,
    faviconUrl,
    siteName: preview.siteName,
    author: oa,
    publishedAt: null,
    extractedText,
    oEmbedAuthor: oa,
  });

  const tagsJson = JSON.stringify(
    Array.isArray(tags) ? tags.slice(0, 30) : []
  );

  const link = await prisma.link.create({
    data: {
      sortOrder: nextSortOrder,
      url: preview.url,
      normalizedUrl: preview.normalizedUrl,
      title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      faviconUrl,
      siteName: preview.siteName,
      domain: preview.domain,
      provider: preview.provider,
      previewType: preview.previewType,
      embedHtml: preview.embedHtml,
      embedUrl: preview.embedUrl,
      oEmbedJson:
        preview.oEmbedJson === null
          ? null
          : JSON.stringify(preview.oEmbedJson),
      tagsJson,
      collectionId: collectionId ?? undefined,
      userId,
      note: note?.trim() ? note.trim() : null,
      extractedText,
      aiProfileJson: JSON.stringify(aiProfile),
      ingestionStatus: "complete",
    },
  });

  return { ok: true, status: 201, link };
}
