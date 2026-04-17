/**
 * Layer 3: Profile-level taste aggregation.
 *
 * Aggregates ItemTasteProfile[] into a TasteDossierV2 taste_summary.
 * Uses LLM when available; falls back to deterministic aggregation.
 *
 * Key principles:
 * - No platform/source labels in output
 * - Clusters by attraction pattern, not by source
 * - Axes aggregated as weighted averages
 * - Confidence weighted by item confidence scores
 */

import OpenAI from "openai";
import type {
  AiMasterProfile,
  EvidenceCluster,
  ItemTasteProfile,
  ProfileAestheticAxes,
  TasteProfileSummary,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// LLM aggregation
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_AGGREGATION_PROMPT = `You are building a taste profile from a collection of saved links.
Each item has already been analyzed for aesthetic signals.

Your task: synthesize all items into a coherent taste graph.

STRICT RULES:
- Do NOT output platform/source names (twitter, youtube, pinterest, telegram, etc.) as taste descriptors
- Do NOT output render/card labels as aesthetics
- Do NOT use generic phrases like "diverse interests" or "eclectic taste"
- DO identify specific, recurrent aesthetic patterns across items
- DO infer what kinds of worlds, aesthetics, and sensibilities the person gravitates toward
- DO write as if conditioning a downstream LLM on this person's taste
- KEEP descriptors specific and non-generic

OUTPUT: Valid JSON only (no markdown):
{
  "core_attraction": ["3-5 most fundamental recurring attractions"],
  "recurring_patterns": ["4-7 patterns that repeat across multiple saves"],
  "visual_preferences": ["3-6 specific visual/compositional tendencies"],
  "conceptual_preferences": ["3-5 intellectual/thematic tendencies"],
  "emotional_preferences": ["2-4 emotional/tonal tendencies"],
  "cultural_gravity": ["2-4 cultural worlds or references they orbit"],
  "preference_axes": {
    "mainstream_vs_niche": 0.0,
    "loud_vs_quiet": 0.0,
    "utility_vs_aesthetic": 0.0,
    "literal_vs_interpretive": 0.0,
    "clean_vs_textured": 0.0,
    "corporate_vs_independent": 0.0
  },
  "likely_likes_more_of": ["4-6 kinds of things they would probably save next"],
  "likely_dislikes": ["3-5 kinds of things they would avoid or ignore"],
  "evidence_backed_clusters": [
    {
      "label": "short cluster name",
      "description": "1 sentence describing the aesthetic/cultural pattern",
      "evidence_item_indices": [0, 1, 2],
      "strength": 0.0
    }
  ],
  "identity_read": "1-2 sentences on what this taste collection says about the person's self-concept",
  "profile_summary_short": "2 sentences — compact, no generic words, suitable for prompting",
  "profile_summary_rich": "3-4 sentences — richer, more evocative, suitable for conditioning",
  "confidence": 0.0
}

Preference axes: -1 to +1 floats. 0 = neutral.
For mainstream_vs_niche: -1 = strongly niche/underground, +1 = strongly mainstream.
Confidence: reflects overall evidence quality across all items.`;

interface LlmProfileResult {
  core_attraction: string[];
  recurring_patterns: string[];
  visual_preferences: string[];
  conceptual_preferences: string[];
  emotional_preferences: string[];
  cultural_gravity: string[];
  preference_axes: ProfileAestheticAxes;
  likely_likes_more_of: string[];
  likely_dislikes: string[];
  evidence_backed_clusters: EvidenceCluster[];
  identity_read: string;
  profile_summary_short: string;
  profile_summary_rich: string;
  confidence: number;
}

function buildItemsContext(items: ItemTasteProfile[]): string {
  return items
    .slice(0, 35)
    .map((item, i) => {
      const parts: string[] = [`[${i}] ${item.title ?? item.domain} (${item.source_kind}/${item.content_type})`];
      if (item.short_summary) parts.push(`  Summary: ${item.short_summary}`);
      if (item.save_reason) parts.push(`  Save reason: ${item.save_reason}`);
      if (item.style_descriptors.length) parts.push(`  Style: ${item.style_descriptors.join(", ")}`);
      if (item.mood_descriptors.length) parts.push(`  Mood: ${item.mood_descriptors.join(", ")}`);
      if (item.appeal_signals.visual.length) parts.push(`  Visual appeal: ${item.appeal_signals.visual.join("; ")}`);
      if (item.appeal_signals.conceptual.length) parts.push(`  Conceptual appeal: ${item.appeal_signals.conceptual.join("; ")}`);
      if (item.appeal_signals.emotional.length) parts.push(`  Emotional: ${item.appeal_signals.emotional.join("; ")}`);
      if (item.cultural_references.length) parts.push(`  Cultural refs: ${item.cultural_references.join(", ")}`);
      if (item.interpretation.length) parts.push(`  Interpretation: ${item.interpretation.join(" ")}`);
      parts.push(`  Confidence: ${item.confidence.toFixed(2)}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

async function aggregateWithLlm(
  items: ItemTasteProfile[],
  client: OpenAI
): Promise<LlmProfileResult | null> {
  if (items.length === 0) return null;
  const context = buildItemsContext(items);
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROFILE_AGGREGATION_PROMPT },
        { role: "user", content: `Analyze these ${items.length} saved items:\n\n${context}` },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as LlmProfileResult;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic fallback aggregation
// ─────────────────────────────────────────────────────────────────────────────

function aggregateAxes(items: ItemTasteProfile[]): ProfileAestheticAxes {
  const highConf = items.filter(i => i.confidence >= 0.5);
  const src = highConf.length > 0 ? highConf : items;
  const avg = (key: keyof typeof src[0]["aesthetic_axes"]) => {
    const vals = src.map(i => i.aesthetic_axes[key]).filter(v => v !== 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  return {
    mainstream_vs_niche: -avg("underground_vs_mainstream"),
    loud_vs_quiet: -(avg("minimal_vs_dense") + avg("decorative_vs_structural")) / 2,
    utility_vs_aesthetic: avg("utility_vs_atmosphere"),
    literal_vs_interpretive: avg("editorial_vs_playful"),
    clean_vs_textured: avg("raw_vs_polished"),
    corporate_vs_independent: avg("underground_vs_mainstream"),
  };
}

function collectTopDescriptors(
  items: ItemTasteProfile[],
  getter: (i: ItemTasteProfile) => string[],
  topN: number
): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const d of getter(item)) {
      if (d.length > 3) {
        counts.set(d, (counts.get(d) ?? 0) + item.confidence);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label]) => label);
}

function buildFallbackProfile(items: ItemTasteProfile[]): LlmProfileResult {
  const styles = collectTopDescriptors(items, i => i.style_descriptors, 6);
  const moods = collectTopDescriptors(items, i => i.mood_descriptors, 4);
  const visual = collectTopDescriptors(items, i => i.appeal_signals.visual, 5);
  const conceptual = collectTopDescriptors(items, i => i.appeal_signals.conceptual, 4);
  const emotional = collectTopDescriptors(items, i => i.appeal_signals.emotional, 3);
  const cultural = collectTopDescriptors(items, i => i.cultural_references, 4);

  const axes = aggregateAxes(items);
  const avgConf = items.length > 0
    ? items.reduce((s, i) => s + i.confidence, 0) / items.length
    : 0;

  // Cluster by taste_role
  const roleMap = new Map<string, number[]>();
  items.forEach((item, idx) => {
    for (const role of item.taste_role) {
      const arr = roleMap.get(role) ?? [];
      arr.push(idx);
      roleMap.set(role, arr);
    }
  });
  const clusters: EvidenceCluster[] = Array.from(roleMap.entries())
    .filter(([, ids]) => ids.length >= 2)
    .map(([role, ids]) => ({
      label: role.replace(/-/g, " "),
      description: `Items saved primarily as ${role} signals.`,
      evidence_item_indices: ids.slice(0, 5),
      strength: ids.length / items.length,
    }));

  const summary = items.length === 0
    ? "No items saved yet."
    : `A collection of ${items.length} saved items across ${new Set(items.map(i => i.domain)).size} sources. ` +
      (styles.length ? `Recurring aesthetic signals: ${styles.slice(0, 3).join(", ")}.` : "");

  return {
    core_attraction: styles.slice(0, 4),
    recurring_patterns: [...styles.slice(0, 3), ...moods.slice(0, 2)],
    visual_preferences: visual,
    conceptual_preferences: conceptual,
    emotional_preferences: emotional,
    cultural_gravity: cultural,
    preference_axes: axes,
    likely_likes_more_of: [],
    likely_dislikes: [],
    evidence_backed_clusters: clusters,
    identity_read: "Insufficient data for reliable identity read.",
    profile_summary_short: summary,
    profile_summary_rich: summary,
    confidence: avgConf,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function buildMasterProfile(
  userSlug: string,
  profiles: ItemTasteProfile[],
  linkIds: string[],
  apiKey?: string | null
): Promise<AiMasterProfile> {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  let result: LlmProfileResult | null = null;
  if (key && profiles.length > 0) {
    const client = new OpenAI({ apiKey: key });
    result = await aggregateWithLlm(profiles, client);
  }
  if (!result) {
    result = buildFallbackProfile(profiles);
  }

  const domains = new Set(profiles.map(p => p.domain));

  // Build the full TasteDossierV2 taste_summary
  const tasteSummary: TasteProfileSummary = {
    ...result,
    vector_ready_text: [
      `TASTE PROFILE: ${userSlug}`,
      result.profile_summary_short,
      result.core_attraction.length ? `CORE: ${result.core_attraction.join("; ")}` : "",
      result.visual_preferences.length ? `VISUAL: ${result.visual_preferences.join("; ")}` : "",
      result.conceptual_preferences.length ? `CONCEPTUAL: ${result.conceptual_preferences.join("; ")}` : "",
      result.cultural_gravity.length ? `CULTURAL: ${result.cultural_gravity.join(", ")}` : "",
      result.likely_dislikes.length ? `AVOIDS: ${result.likely_dislikes.join("; ")}` : "",
    ].filter(Boolean).join("\n"),
  };

  // Return AiMasterProfile shape for backward compat with export-payload.ts
  return {
    schema_version: 1,
    user_slug: userSlug,
    generated_at: new Date().toISOString(),
    taste_summary_paragraph: result.profile_summary_short,
    top_themes: result.core_attraction.map((label, i) => ({ label, weight: result!.core_attraction.length - i })),
    top_aesthetics: result.visual_preferences.map((label, i) => ({ label, weight: result!.visual_preferences.length - i })),
    content_type_breakdown: Object.fromEntries(
      Array.from(new Map(profiles.map(p => [p.content_type, 0])).entries())
        .map(([k]) => [k, profiles.filter(p => p.content_type === k).length])
    ),
    clusters: result.evidence_backed_clusters.map(c => ({
      id: c.label.replace(/\s+/g, "_"),
      label: c.label,
      link_ids: c.evidence_item_indices.map(i => linkIds[i]).filter(Boolean),
    })),
    representative_link_ids: linkIds.slice(0, 5),
    aggregate_stats: {
      total_items: profiles.length,
      unique_domains: domains.size,
      providers: Object.fromEntries(
        Array.from(new Set(profiles.map(p => p.source_kind))).map(k => [k, profiles.filter(p => p.source_kind === k).length])
      ),
    },
    semantic_overview: [
      `Core attraction: ${result.core_attraction.join("; ")}`,
      `Visual: ${result.visual_preferences.join("; ")}`,
      `Likely dislikes: ${result.likely_dislikes.join("; ")}`,
    ].filter(s => !s.endsWith(": ")).join("\n"),
    saved_items: profiles as AiMasterProfile["saved_items"],
    // Also attach the rich taste summary for new consumers
    ...(({ taste_summary: tasteSummary } as object)),
  } as AiMasterProfile;
}

export function masterProfileToMarkdown(
  m: AiMasterProfile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _linkIds: string[]
): string {
  const ts = (m as unknown as { taste_summary?: TasteProfileSummary }).taste_summary;

  const lines: string[] = [
    `# Taste dossier — ${m.user_slug}`,
    ``,
    `_Generated: ${m.generated_at}_`,
    ``,
  ];

  if (ts?.profile_summary_rich) {
    lines.push(`## Profile`, ``, ts.profile_summary_rich, ``);
  } else {
    lines.push(`## Profile`, ``, m.taste_summary_paragraph, ``);
  }

  if (ts?.core_attraction?.length) {
    lines.push(`## Core attractions`, ...ts.core_attraction.map(s => `- ${s}`), ``);
  }
  if (ts?.visual_preferences?.length) {
    lines.push(`## Visual preferences`, ...ts.visual_preferences.map(s => `- ${s}`), ``);
  }
  if (ts?.recurring_patterns?.length) {
    lines.push(`## Recurring patterns`, ...ts.recurring_patterns.map(s => `- ${s}`), ``);
  }
  if (ts?.likely_dislikes?.length) {
    lines.push(`## Likely dislikes`, ...ts.likely_dislikes.map(s => `- ${s}`), ``);
  }
  if (ts?.likely_likes_more_of?.length) {
    lines.push(`## Would likely save more of`, ...ts.likely_likes_more_of.map(s => `- ${s}`), ``);
  }
  if (ts?.identity_read) {
    lines.push(`## Identity read`, ``, ts.identity_read, ``);
  }
  if (ts?.evidence_backed_clusters?.length) {
    lines.push(`## Taste clusters`);
    for (const c of ts.evidence_backed_clusters) {
      lines.push(`- **${c.label}** (strength: ${(c.strength * 100).toFixed(0)}%) — ${c.description}`);
    }
    lines.push(``);
  }

  lines.push(
    `## Preference axes`,
    ts?.preference_axes ? [
      `- mainstream_vs_niche: ${ts.preference_axes.mainstream_vs_niche.toFixed(2)}`,
      `- loud_vs_quiet: ${ts.preference_axes.loud_vs_quiet.toFixed(2)}`,
      `- utility_vs_aesthetic: ${ts.preference_axes.utility_vs_aesthetic.toFixed(2)}`,
      `- corporate_vs_independent: ${ts.preference_axes.corporate_vs_independent.toFixed(2)}`,
    ].join("\n") : "_no data_",
    ``,
    `## Saved items (${m.saved_items.length})`,
    ``,
    `See JSON export for full machine-readable profiles with vector_ready_text per item.`
  );

  return lines.join("\n");
}
