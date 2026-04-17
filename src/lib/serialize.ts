import type { Collection, Link } from "@prisma/client";
import type { ItemTasteProfile as AiLinkProfile } from "@/lib/ai-taste/types";
import type { CollectionWithCount, LinkSerialized } from "@/types/link";

function parseOEmbedJson(
  raw: string | null | undefined
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parseAiProfileJson(
  raw: string | null | undefined
): AiLinkProfile | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as AiLinkProfile;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function serializeLink(link: Link): LinkSerialized {
  return {
    id: link.id,
    url: link.url,
    normalizedUrl: link.normalizedUrl,
    title: link.title,
    description: link.description,
    imageUrl: link.imageUrl,
    faviconUrl: link.faviconUrl,
    siteName: link.siteName,
    domain: link.domain,
    provider: link.provider,
    previewType: link.previewType,
    embedHtml: link.embedHtml,
    embedUrl: link.embedUrl,
    oEmbedJson: parseOEmbedJson(link.oEmbedJson),
    note: link.note,
    collectionId: link.collectionId,
    isPublic: link.isPublic,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    aiProfile: parseAiProfileJson(link.aiProfileJson),
  };
}

export function serializeCollection(
  c: Collection & { _count?: { links: number } }
): CollectionWithCount {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    createdAt: c.createdAt.toISOString(),
    _count: c._count ?? { links: 0 },
  };
}
