import type { Collection, Link } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildLinkAiProfile } from "./build-link-profile";
import { buildMasterProfile } from "./build-master-profile";
import type { AiLinkProfile, AiMasterProfile } from "./types";

function parseOEmbed(
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

async function ensureLinkProfile(link: Link): Promise<AiLinkProfile> {
  if (link.aiProfileJson) {
    try {
      return JSON.parse(link.aiProfileJson) as AiLinkProfile;
    } catch {
      /* rebuild */
    }
  }
  const o = parseOEmbed(link.oEmbedJson);
  const oEmbedAuthor =
    o && typeof o.author_name === "string" ? o.author_name : null;
  const profile = buildLinkAiProfile({
    normalizedUrl: link.normalizedUrl,
    url: link.url,
    canonicalUrl: link.canonicalUrl,
    title: link.title,
    description: link.description,
    domain: link.domain,
    provider: link.provider,
    previewType: link.previewType,
    imageUrl: link.imageUrl,
    faviconUrl: link.faviconUrl,
    siteName: link.siteName,
    author: link.author,
    publishedAt: link.publishedAt,
    extractedText: link.extractedText,
    oEmbedAuthor,
  });
  await prisma.link.update({
    where: { id: link.id },
    data: { aiProfileJson: JSON.stringify(profile) },
  });
  return profile;
}

export type TasteExportJson = {
  user_profile: {
    slug: string;
    display_name: string | null;
    taste_summary: string;
    top_themes: { label: string; weight: number }[];
    top_aesthetics: { label: string; weight: number }[];
    semantic_overview: string;
    representative_link_ids: string[];
  };
  collections: {
    id: string;
    name: string;
    slug: string;
    link_count: number;
  }[];
  saved_items: AiLinkProfile[];
  link_ids: string[];
  clusters: AiMasterProfile["clusters"];
  aggregate_stats: AiMasterProfile["aggregate_stats"];
  generated_at: string;
};

export async function buildTasteExportForSlug(
  slug: string
): Promise<{
  json: TasteExportJson;
  master: AiMasterProfile;
  collections: Collection[];
} | null> {
  const user = await prisma.user.findUnique({ where: { slug } });
  if (!user) return null;

  const [links, collections] = await Promise.all([
    prisma.link.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      include: { _count: { select: { links: true } } },
    }),
  ]);

  const profiles: AiLinkProfile[] = [];
  const linkIds: string[] = [];
  for (const link of links) {
    linkIds.push(link.id);
    profiles.push(await ensureLinkProfile(link));
  }

  const master = buildMasterProfile(slug, profiles, linkIds);

  const json: TasteExportJson = {
    user_profile: {
      slug: user.slug,
      display_name: user.displayName,
      taste_summary: master.taste_summary_paragraph,
      top_themes: master.top_themes,
      top_aesthetics: master.top_aesthetics,
      semantic_overview: master.semantic_overview,
      representative_link_ids: master.representative_link_ids,
    },
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      link_count: c._count.links,
    })),
    saved_items: profiles,
    link_ids: linkIds,
    clusters: master.clusters,
    aggregate_stats: master.aggregate_stats,
    generated_at: master.generated_at,
  };

  return { json, master, collections };
}
