import type { Collection, Link } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildLinkAiProfileAsync } from "./build-link-profile";
import { buildMasterProfile, masterProfileToMarkdown } from "./build-master-profile";
import type { AiMasterProfile, ItemTasteProfile, TasteDossierV2 } from "./types";

export { masterProfileToMarkdown };

function parseOEmbed(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* ignore */ }
  return null;
}

function parseLinkProfile(json: string | null): ItemTasteProfile | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    // Detect v2 by presence of appeal_signals.visual
    if (v && typeof v.appeal_signals === "object" && v.url && v.domain) {
      return v as unknown as ItemTasteProfile;
    }
  } catch { /* rebuild */ }
  return null;
}

async function ensureLinkProfile(
  link: Link,
  apiKey?: string | null
): Promise<ItemTasteProfile> {
  // Try to use cached v2 profile
  const cached = parseLinkProfile(link.aiProfileJson);
  if (cached) return cached;

  const o = parseOEmbed(link.oEmbedJson);
  const oEmbedAuthor = o && typeof o.author_name === "string" ? o.author_name : null;

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
      oEmbedAuthor,
      visionDescription: null,
      userNote: link.note,
    },
    apiKey
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

// ─── Public export types ──────────────────────────────────────────────────────

// TasteDossierV2 re-exported for API consumers
export type { TasteDossierV2 };

export type TasteExportJson = Omit<TasteDossierV2, "taste_summary"> & {
  taste_summary: import("./types").TasteProfileSummary;
  // Backward compat fields
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

export async function buildTasteExportForSlug(
  slug: string,
  apiKey?: string | null
): Promise<{
  json: TasteExportJson;
  master: AiMasterProfile;
  collections: Collection[];
} | null> {
  const user = await prisma.user.findUnique({ where: { slug } });
  if (!user) return null;

  // Try to load user's own API key if not passed
  let resolvedKey = apiKey ?? null;
  if (!resolvedKey) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { openaiApiKey: true },
      });
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

  const profiles: ItemTasteProfile[] = [];
  const linkIds: string[] = [];
  for (const link of links) {
    linkIds.push(link.id);
    profiles.push(await ensureLinkProfile(link, resolvedKey));
  }

  const master = await buildMasterProfile(slug, profiles, linkIds, resolvedKey);

  type MasterWithExtras = AiMasterProfile & {
    taste_summary?: TasteExportJson["taste_summary"];
    taste_psychology?: import("./types").TastePsychology | null;
    visual_taste_summary?: import("./types").VisualTasteSummary | null;
  };
  const masterExt = master as MasterWithExtras;

  const tasteSummary: TasteExportJson["taste_summary"] = masterExt.taste_summary ?? {
    strong_signals: [],
    emerging_signals: [],
    weak_hypotheses: [],
    visual_preferences: master.top_aesthetics.map(a => a.label),
    conceptual_preferences: [],
    emotional_preferences: [],
    cultural_gravity: [],
    preference_axes: { mainstream_vs_niche: 0, loud_vs_quiet: 0, utility_vs_aesthetic: 0, literal_vs_interpretive: 0, clean_vs_textured: 0, corporate_vs_independent: 0 },
    likely_dislikes: [],
    likely_likes_more_of: [],
    evidence_backed_clusters: master.clusters.map(c => ({ label: c.label, description: c.label, evidence_item_indices: [], strength: 0.5 })),
    profile_summary_short: master.taste_summary_paragraph,
    profile_summary_rich: master.taste_summary_paragraph,
    vector_ready_text: master.semantic_overview,
    confidence: 0.5,
  };

  const dossier: TasteDossierV2 = {
    profile_id: user.slug,
    profile_version: "taste_dossier_v2",
    generated_at: master.generated_at,
    stats: {
      item_count: profiles.length,
      domain_count: new Set(profiles.map(p => p.domain)).size,
      language_mix: Array.from(new Set(profiles.map(p => p.language).filter((l): l is string => Boolean(l)))),
      source_mix: Object.fromEntries(
        Array.from(new Set(profiles.map(p => p.source_kind))).map(k => [
          k, profiles.filter(p => p.source_kind === k).length
        ])
      ),
      content_type_mix: Object.fromEntries(
        Array.from(new Set(profiles.map(p => p.content_type))).map(k => [
          k, profiles.filter(p => p.content_type === k).length
        ])
      ),
      has_vision_analysis: profiles.some(p => p.observable_evidence.some(e => e.startsWith("Visual:"))),
      has_transcripts: profiles.some(p => p.source_kind === "video" && p.confidence > 0.4),
    },
    saved_items: profiles,
    taste_summary: tasteSummary,
    taste_psychology: masterExt.taste_psychology ?? null,
    visual_taste_summary: masterExt.visual_taste_summary ?? null,
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
    collections: collections.map(c => ({
      id: c.id, name: c.name, slug: c.slug, link_count: c._count.links,
    })),
    link_ids: linkIds,
    clusters: master.clusters,
    aggregate_stats: master.aggregate_stats,
  };

  return { json, master, collections };
}
