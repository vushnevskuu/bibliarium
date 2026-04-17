import type { Collection, Link } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildLinkAiProfileAsync } from "./build-link-profile";
import { buildMasterProfile, masterProfileToMarkdown } from "./build-master-profile";
import type {
  AiMasterProfile,
  SavedItemV4,
  TasteDossierV4,
} from "./types";

export { masterProfileToMarkdown };
export type { TasteDossierV4 as TasteDossierExport };

// ─────────────────────────────────────────────────────────────────────────────

function parseStoredProfile(json: string | null): SavedItemV4 | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    // v4 detection: has visual_layer and save_intent
    if (v && typeof v.visual_layer === "object" && typeof v.save_intent === "object") {
      return v as unknown as SavedItemV4;
    }
  } catch { /* rebuild */ }
  return null;
}

async function buildItem(
  link: Link,
  index: number,
  apiKey?: string | null
): Promise<SavedItemV4> {
  // Try cached v4 profile
  const cached = parseStoredProfile(link.aiProfileJson);
  if (cached) return { ...cached, item_index: index };

  const oEmbed = link.oEmbedJson ? (() => { try { return JSON.parse(link.oEmbedJson!) as Record<string, unknown>; } catch { return null; } })() : null;

  const profile = await buildLinkAiProfileAsync(
    {
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
      oEmbedAuthor: oEmbed && typeof oEmbed.author_name === "string" ? oEmbed.author_name : null,
      userNote: link.note,
    },
    apiKey,
    index
  );

  // Cache it
  try {
    await prisma.link.update({
      where: { id: link.id },
      data: { aiProfileJson: JSON.stringify(profile) },
    });
  } catch { /* non-critical */ }

  return profile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export types (backward compat)
// ─────────────────────────────────────────────────────────────────────────────

export type TasteExportJson = TasteDossierV4 & {
  // Legacy fields consumed by /api/taste/export and /analysis page
  user_profile: {
    slug: string;
    display_name: string | null;
    taste_summary: string;
    top_themes: { label: string; weight: number }[];
    top_aesthetics: { label: string; weight: number }[];
    semantic_overview: string;
    representative_link_ids: string[];
  };
  collections: { id: string; name: string; slug: string; link_count: number }[];
  link_ids: string[];
  clusters: AiMasterProfile["clusters"];
  aggregate_stats: AiMasterProfile["aggregate_stats"];
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export builder
// ─────────────────────────────────────────────────────────────────────────────

export async function buildTasteExportForSlug(
  slug: string,
  apiKey?: string | null
): Promise<{ json: TasteExportJson; master: AiMasterProfile; collections: Collection[] } | null> {
  const user = await prisma.user.findUnique({ where: { slug } });
  if (!user) return null;

  // Resolve API key from user record if not passed
  let resolvedKey = apiKey ?? null;
  if (!resolvedKey) {
    try {
      const u = await prisma.user.findUnique({ where: { id: user.id }, select: { openaiApiKey: true } });
      resolvedKey = u?.openaiApiKey ?? null;
    } catch { /* migration pending */ }
  }

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

  const profiles: SavedItemV4[] = [];
  const linkIds: string[] = [];
  for (let i = 0; i < links.length; i++) {
    linkIds.push(links[i].id);
    profiles.push(await buildItem(links[i], i, resolvedKey));
  }

  const master = await buildMasterProfile(slug, profiles, linkIds, resolvedKey);

  // Source mix for stats
  const sourceMap = new Map<string, number>();
  for (const p of profiles) {
    const s = p.source_kind;
    sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1);
  }

  const dossier: TasteDossierV4 = {
    profile_id: user.slug,
    profile_version: "taste_dossier_v4",
    generated_at: master.generated_at,
    stats: {
      item_count: profiles.length,
      domain_count: new Set(profiles.map(p => p.domain)).size,
      language_mix: [],
      source_mix: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
    },
    saved_items: profiles,
    visual_profile: master.visual_profile ?? null,
    cultural_profile: master.cultural_profile ?? null,
    utility_profile: master.utility_profile ?? null,
    save_behavior_profile: master.save_behavior_profile ?? {
      summary_short: "No behavior data.",
      selection_style: {
        collects_for_visual_reference: 0, collects_for_cultural_signal: 0,
        collects_for_future_use: 0, collects_for_identity_expression: 0,
        collects_for_practical_implementation: 0, collects_rare_over_popular: 0,
        collects_authored_over_generic: 0,
      },
      save_intent_distribution: [],
      behavioral_notes: [],
      confidence: 0,
    },
    taste_psychology: master.taste_psychology ?? null,
    master_summary: master.master_summary ?? {
      profile_summary_short: master.taste_summary_paragraph,
      profile_summary_rich: master.taste_summary_paragraph,
      confidence: 0.5,
      vector_ready_text: master.semantic_overview,
    },
  };

  const json: TasteExportJson = {
    ...dossier,
    user_profile: {
      slug: user.slug,
      display_name: user.displayName,
      taste_summary: master.taste_summary_paragraph,
      top_themes: master.top_themes,
      top_aesthetics: master.top_aesthetics,
      semantic_overview: master.semantic_overview,
      representative_link_ids: master.representative_link_ids,
    },
    collections: collections.map(c => ({ id: c.id, name: c.name, slug: c.slug, link_count: c._count.links })),
    link_ids: linkIds,
    clusters: master.clusters,
    aggregate_stats: master.aggregate_stats,
  };

  return { json, master, collections };
}
