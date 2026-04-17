/**
 * Profile aggregation — v4 architecture.
 *
 * Produces 4 separate profile sections + taste_psychology + master_summary.
 * Items are ROUTED before aggregation based on profile_routing flags.
 * Utility/tool items CANNOT affect visual_profile.
 */

import OpenAI from "openai";
import type {
  AiMasterProfile,
  CulturalProfile,
  EvidencedSignal,
  MasterSummary,
  PersonaBlendEntry,
  SaveBehaviorProfile,
  SavedItemV4,
  SaveIntent,
  SelectionStyle,
  TastePsychologyV4,
  TraitHypothesis,
  UtilityProfile,
  VisualProfile,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

const VISUAL_PROFILE_PROMPT = `Analyze these visual-routed saved items and produce a visual taste profile.

STRICT RULES — violations make the output useless:
1. Language: "Current saves suggest..." — never "this person is/has/shows"
2. recurring_visual_signals: ONLY include signals appearing in 2+ items. Single-item signals must not appear here.
3. strength/confidence must match evidence: if only 2 items support a signal, confidence < 0.55
4. confidence at profile level MUST equal the average of recurring signal confidences — never output 0.0 when signals are non-zero
5. likely_visual_likes_more_of: grounded in observed patterns only, 3-4 items max
6. DO NOT produce negative meta-judgments about the user (no "narrow scope", "disconnect", "limited", etc.)
7. DO NOT assume unusual/strange imagery = meme/joke interest. Infer visual qualities: linework, illustration style, graphic attitude, palette, composition, subcultural visual language.
8. DO NOT overweight single-item themes — they must stay in individual items, not the profile
9. When evidence is thin: fewer signals, lower confidence. Output less, not more.
10. DO NOT produce personality conclusions (no "this person tends to...", "suggests a personality that...")

Output describes WHAT REPEATS in the saves, nothing else.

OUTPUT valid JSON:
{
  "summary_short": "1-2 sentences starting with 'Current saves suggest...' Dry, precise, no evaluative language.",
  "recurring_visual_signals": [
    { "label": "...", "strength": 0.0, "confidence": 0.0, "coverage_count": 0, "evidence_item_indices": [] }
  ],
  "visual_preference_axes": {
    "clean_vs_textured": 0.0,
    "polished_vs_raw": 0.0,
    "commercial_vs_authored": 0.0,
    "literal_vs_symbolic": 0.0,
    "mainstream_vs_subcultural": 0.0,
    "decorative_vs_structural": 0.0
  },
  "repeated_moods": ["max 3 mood strings, only from multi-item patterns"],
  "likely_visual_likes_more_of": ["3-4 specific types grounded in evidence"],
  "confidence": 0.0,
  "vector_ready_text": "compact, non-evaluative, embedding-ready summary of recurring visual signals"
}`;

const CULTURAL_PROFILE_PROMPT = `Analyze these culturally-routed saved items.

STRICT RULES:
1. "Current saves suggest..." language — never "this person is/has/tends to"
2. core_attraction: only patterns supported by 2+ items. Leave empty if none.
3. recurring_patterns: 2+ items required per pattern. Single items = omit.
4. likely_dislikes: ONLY include if real counter-evidence exists (e.g. multiple saves explicitly avoiding a type). Otherwise: empty array.
5. DO NOT infer limitations, weaknesses, disconnects, or evaluative judgments from the data.
6. confidence at profile level must equal average of pattern confidences — not 0.0 when patterns are present.
7. When evidence is thin: fewer claims, lower confidence. Do not fill in with generic observations.

OUTPUT valid JSON:
{
  "summary_short": "1-2 sentences. Dry. 'Current saves suggest...'. No meta-judgments.",
  "core_attraction": [],
  "recurring_patterns": [
    { "label": "...", "strength": 0.0, "confidence": 0.0, "coverage_count": 0, "evidence_item_indices": [] }
  ],
  "cultural_gravity": [],
  "likely_likes_more_of": [],
  "likely_dislikes": [],
  "confidence": 0.0,
  "vector_ready_text": "..."
}`;

const UTILITY_PROFILE_PROMPT = `Analyze these utility/tool-routed saved items.

OUTPUT valid JSON:
{
  "summary_short": "...",
  "tooling_interests": [
    { "label": "...", "strength": 0.0, "confidence": 0.0, "coverage_count": 0, "evidence_item_indices": [] }
  ],
  "workflow_preferences": ["2-3 behavioral patterns"],
  "confidence": 0.0,
  "vector_ready_text": "..."
}`;

const PSYCHOLOGY_PROMPT = `Infer non-clinical aesthetic and cognition tendencies from saved links.

ABSOLUTE GUARDRAILS:
- NOT diagnosis, NOT clinical, NOT MBTI, NOT personality test
- No mental health, trauma, intelligence, attachment, political claims
- DO NOT produce negative conclusions about the user (no "lacks X", "limited Y", "disconnected from Z")
- DO NOT make evaluative judgments from sparse data
- estimated_level is a 0.0–1.0 probability scalar — not a category
- If fewer than 3 items support a trait: confidence must be < 0.4
- "save patterns tentatively suggest..." language only
- When evidence is thin: omit traits entirely rather than speculating
- Persona descriptions must be neutral and descriptive, NOT evaluative

TRAITS to analyze (only include if 2+ items support it):
openness_to_experience, aesthetic_engagement, need_for_cognition,
tolerance_for_ambiguity, novelty_seeking, independence_of_taste,
identity_signaling_via_curation

OUTPUT valid JSON:
{
  "trait_hypotheses": [
    { "trait": "...", "label": "...", "estimated_level": 0.0, "confidence": 0.0, "evidence": ["observable fact 1", "observable fact 2"], "coverage_item_indices": [] }
  ],
  "persona_blend": [
    { "persona": "...", "weight": 0.0, "description": "1 sentence, neutral, no evaluation" }
  ],
  "confidence": 0.0,
  "vector_ready_text": "..."
}`;

const MASTER_SUMMARY_PROMPT = `Write a master summary for a taste dossier.

Inputs: visual profile summary, cultural profile summary, utility profile notes, save behavior data.

RULES:
1. profile_summary_short: 1-2 sentences. Dry. "Current saves suggest..." Never "this person is..."
2. profile_summary_rich: 3-4 sentences. Describe recurring attraction patterns only.
   - No evaluative language about the person (no "narrow", "limited", "disconnects", "lacks")
   - No personality conclusions that outrun the evidence
   - No negative meta-judgments of any kind
   - Only describe what repeatedly appears in the saves
3. vector_ready_text: compact, non-evaluative, LLM-conditioning-ready
4. confidence must reflect actual evidence quality — if profile summaries contain real signals, confidence >= 0.5

OUTPUT valid JSON:
{
  "profile_summary_short": "...",
  "profile_summary_rich": "...",
  "confidence": 0.0,
  "vector_ready_text": "..."
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Item context serializer
// ─────────────────────────────────────────────────────────────────────────────

function serializeItems(items: SavedItemV4[], indices: number[]): string {
  return indices.slice(0, 25).map(i => {
    const item = items[i];
    if (!item) return "";
    const parts = [
      `[${i}] ${item.title ?? item.domain} | ${item.item_kind} | intent=${item.save_intent.primary}`,
      `  Summary: ${item.semantic_layer.short_summary}`,
    ];
    if (item.visual_layer.present && item.visual_layer.stylistic_signals.length) {
      parts.push(`  Visual: ${item.visual_layer.stylistic_signals.join(", ")}`);
    }
    if (item.visual_layer.emotional_tone?.length) {
      parts.push(`  Mood: ${item.visual_layer.emotional_tone.join(", ")}`);
    }
    parts.push(`  Save reason: ${item.taste_interpretation.save_reason}`);
    parts.push(`  Weight aesthetic: ${item.taste_interpretation.weight_in_aesthetic_aggregation.toFixed(2)}`);
    return parts.filter(Boolean).join("\n");
  }).filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM calls
// ─────────────────────────────────────────────────────────────────────────────

async function llmJson<T>(
  prompt: string,
  userContent: string,
  client: OpenAI,
  maxTokens = 1000
): Promise<T | null> {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userContent },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic fallbacks
// ─────────────────────────────────────────────────────────────────────────────

function countWeightedSignals(
  items: SavedItemV4[],
  indices: number[],
  getSignals: (item: SavedItemV4) => string[],
  minCount = 1
): EvidencedSignal[] {
  const map = new Map<string, { score: number; count: number; idx: number[] }>();
  for (const i of indices) {
    const item = items[i];
    if (!item) continue;
    // Use max(weight, 0.3) so items without explicit weights still contribute
    const weight = Math.max(item.taste_interpretation.weight_in_aesthetic_aggregation ?? 0, 0.3);
    for (const s of getSignals(item)) {
      if (!s || s.length < 3) continue;
      const e = map.get(s) ?? { score: 0, count: 0, idx: [] };
      e.score += weight;
      e.count++;
      e.idx.push(i);
      map.set(s, e);
    }
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.count >= minCount)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 8)
    .map(([label, v]) => {
      const coverage = v.count / Math.max(indices.length, 1);
      // Confidence: based on coverage AND score magnitude, floored at 0.15 if count >= 1
      const rawConf = Math.min(0.85, coverage * 1.4);
      const confidence = parseFloat(Math.max(0.15, rawConf).toFixed(2));
      return {
        label,
        strength: parseFloat(Math.min(1, coverage * 1.5).toFixed(2)),
        confidence,
        coverage_count: v.count,
        evidence_item_indices: v.idx,
      };
    });
}

/** Derive profile-level confidence from its signals — never returns 0.0 when signals exist */
function profileConfidenceFromSignals(signals: EvidencedSignal[]): number {
  if (signals.length === 0) return 0.2;
  const avg = signals.reduce((s, sig) => s + sig.confidence, 0) / signals.length;
  return parseFloat(Math.max(0.25, avg).toFixed(2));
}

function fallbackVisualProfile(items: SavedItemV4[], indices: number[]): VisualProfile {
  // Require 2+ items for a signal to appear in the profile — single-item signals stay local
  const recurring = countWeightedSignals(items, indices, i => i.visual_layer.stylistic_signals, 2);
  const moods = countWeightedSignals(items, indices, i => i.visual_layer.emotional_tone, 2);
  const avgAuth = indices.reduce((s, i) => s + (items[i]?.visual_layer.visual_authorship ?? 0), 0) / Math.max(indices.length, 1);
  const avgOddity = indices.reduce((s, i) => s + (items[i]?.visual_layer.visual_oddity ?? 0), 0) / Math.max(indices.length, 1);
  const confidence = profileConfidenceFromSignals(recurring);
  return {
    summary_short: recurring.length
      ? `Current saves suggest recurring visual signals: ${recurring.slice(0, 2).map(s => s.label).join(", ")}.`
      : `Current saves contain visual items but insufficient recurring signals for pattern detection.`,
    recurring_visual_signals: recurring,
    visual_preference_axes: {
      clean_vs_textured: 0,
      polished_vs_raw: -(avgAuth - 0.5),
      commercial_vs_authored: avgAuth,
      literal_vs_symbolic: 0,
      mainstream_vs_subcultural: avgOddity,
      decorative_vs_structural: 0,
    },
    repeated_moods: moods.slice(0, 3).map(m => m.label),
    likely_visual_likes_more_of: [],
    confidence,
    vector_ready_text: recurring.length
      ? `Visual signals (${indices.length} items): ${recurring.slice(0, 4).map(s => s.label).join(", ")}`
      : `Visual items present but no recurring pattern detected across ${indices.length} items.`,
  };
}

function fallbackCulturalProfile(items: SavedItemV4[], indices: number[]): CulturalProfile {
  const patterns = countWeightedSignals(items, indices, i => [
    ...(i.visual_layer.cultural_signal ?? []),
  ], 2); // only multi-item patterns
  const confidence = profileConfidenceFromSignals(patterns);
  return {
    summary_short: patterns.length
      ? `Current saves suggest cultural interest in: ${patterns.slice(0, 2).map(p => p.label).join(", ")}.`
      : `Current saves contain culturally-routed items but no recurring pattern detected.`,
    core_attraction: patterns.slice(0, 3).map(p => p.label),
    recurring_patterns: patterns.slice(0, 5),
    cultural_gravity: [],
    likely_likes_more_of: [],
    likely_dislikes: [], // never populated by heuristic — requires real counter-evidence
    confidence,
    vector_ready_text: patterns.length
      ? `Cultural signals: ${patterns.slice(0, 3).map(p => p.label).join(", ")}`
      : `No recurring cultural patterns detected.`,
  };
}

function fallbackUtilityProfile(items: SavedItemV4[], indices: number[]): UtilityProfile {
  const domains = Array.from(new Set(indices.map(i => items[i]?.domain).filter((d): d is string => Boolean(d))));
  return {
    summary_short: `${indices.length} utility/tool saves detected. Should not affect aesthetic profile.`,
    tooling_interests: countWeightedSignals(items, indices, i => [i.item_kind]).slice(0, 4),
    workflow_preferences: [`Tool saves from: ${domains.slice(0, 4).join(", ")}`],
    should_not_contaminate_visual_profile: true,
    confidence: 0.5,
    vector_ready_text: `Utility profile: ${indices.length} items. Not to be included in aesthetic aggregation.`,
  };
}

function buildSaveBehavior(items: SavedItemV4[]): SaveBehaviorProfile {
  const intentCounts = new Map<SaveIntent, number>();
  for (const item of items) {
    const p = item.save_intent.primary;
    intentCounts.set(p, (intentCounts.get(p) ?? 0) + 1);
  }

  const visualItems = items.filter(i => i.profile_routing.affects_visual_profile).length;
  const utilityItems = items.filter(i => i.profile_routing.affects_utility_profile).length;
  const tasteItems = items.filter(i => i.taste_interpretation.should_affect_aesthetic_profile).length;
  const total = Math.max(items.length, 1);

  const avgAuthored = items.reduce((s, i) => s + i.visual_layer.visual_authorship, 0) / total;
  const avgOddity = items.reduce((s, i) => s + i.visual_layer.visual_oddity, 0) / total;

  const selectionStyle: SelectionStyle = {
    collects_for_visual_reference: parseFloat((visualItems / total).toFixed(2)),
    collects_for_cultural_signal: parseFloat(((intentCounts.get("cultural_signal") ?? 0) / total).toFixed(2)),
    collects_for_future_use: parseFloat(((utilityItems) / total).toFixed(2)),
    collects_for_identity_expression: parseFloat(((intentCounts.get("identity_signal") ?? 0) / total).toFixed(2)),
    collects_for_practical_implementation: parseFloat(((intentCounts.get("workflow_resource") ?? 0) / total).toFixed(2)),
    collects_rare_over_popular: parseFloat(Math.min(1, avgOddity * 1.2).toFixed(2)),
    collects_authored_over_generic: parseFloat(Math.min(1, avgAuthored * 1.1).toFixed(2)),
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _topIntents = Array.from(intentCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([i]) => i);
  const tasteRatio = tasteItems / total;
  const utilityRatio = utilityItems / total;

  return {
    summary_short: `${items.length} saves: ${(tasteRatio * 100).toFixed(0)}% taste-driven, ${(utilityRatio * 100).toFixed(0)}% utility. Mixed curation pattern.`,
    selection_style: selectionStyle,
    save_intent_distribution: Array.from(intentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([intent, count]) => ({ intent, count })),
    behavioral_notes: [
      tasteRatio > 0.6 ? "Predominantly taste-driven curation." : "Mixed practical and taste curation.",
      utilityRatio > 0.3 ? "Significant utility saves — must be routed away from aesthetic profile." : "Low utility contamination risk.",
    ],
    confidence: 0.65,
  };
}

function fallbackPsychology(items: SavedItemV4[]): Omit<TastePsychologyV4, "guardrails"> | null {
  if (items.length < 4) return null;
  const visualItems = items.filter(i => i.profile_routing.affects_visual_profile);
  const avgOddity = visualItems.reduce((s, i) => s + i.visual_layer.visual_oddity, 0) / Math.max(visualItems.length, 1);
  const avgAuth = visualItems.reduce((s, i) => s + i.visual_layer.visual_authorship, 0) / Math.max(visualItems.length, 1);
  const visualIndices = visualItems.map(i => i.item_index);

  const visualFraction = visualItems.length / items.length;
  const traits: TraitHypothesis[] = [];
  // Only add traits with real multi-item evidence
  if (visualIndices.length >= 2) {
    traits.push({
      trait: "aesthetic_engagement", label: "Aesthetic Engagement",
      estimated_level: parseFloat(Math.min(0.85, (avgAuth + visualFraction) / 2).toFixed(2)),
      confidence: parseFloat(Math.min(0.65, visualFraction * 0.9).toFixed(2)),
      evidence: [`${visualIndices.length} of ${items.length} saves appear visually driven`],
      coverage_item_indices: visualIndices.slice(0, 4),
    });
  }
  if (avgOddity > 0.4 && visualIndices.length >= 2) {
    traits.push({
      trait: "independence_of_taste", label: "Independence of Taste",
      estimated_level: parseFloat(Math.min(0.8, avgOddity).toFixed(2)),
      confidence: parseFloat(Math.min(0.55, avgOddity * 0.85).toFixed(2)),
      evidence: ["Saves include non-mainstream visual references"],
      coverage_item_indices: visualIndices.slice(0, 3),
    });
  }

  const personas: PersonaBlendEntry[] = [];
  if (avgOddity > 0.5 && visualIndices.length >= 2) {
    personas.push({ persona: "authored_visual_selector", weight: parseFloat(Math.min(0.85, avgOddity).toFixed(2)), description: `Saves show attraction to non-generic visual language across ${visualIndices.length} items.` });
  }
  const utilityRatio = items.filter(i => i.profile_routing.affects_utility_profile).length / items.length;
  if (utilityRatio > 0.25) {
    personas.push({ persona: "mixed_curator", weight: parseFloat(utilityRatio.toFixed(2)), description: `${Math.round(utilityRatio * 100)}% of saves are utility-oriented; these are separate from aesthetic signals.` });
  }

  if (traits.length === 0 && personas.length === 0) return null;
  const psychConf = traits.length > 0
    ? parseFloat((traits.reduce((s, t) => s + t.confidence, 0) / traits.length).toFixed(2))
    : 0.25;
  return {
    trait_hypotheses: traits,
    persona_blend: personas,
    confidence: psychConf,
    vector_ready_text: traits.length
      ? `Heuristic tendencies (low confidence): ${traits.map(t => `${t.label}=${t.estimated_level.toFixed(2)}`).join(", ")}`
      : "Insufficient evidence for psychological hypotheses.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function buildMasterProfile(
  userSlug: string,
  profiles: SavedItemV4[],
  linkIds: string[],
  apiKey?: string | null
): Promise<AiMasterProfile> {
  const key = apiKey ?? process.env.OPENAI_API_KEY;

  // Route items into separate buckets
  const visualIndices = profiles.map((p, i) => ({ p, i })).filter(({ p }) => p.profile_routing.affects_visual_profile).map(({ i }) => i);
  const culturalIndices = profiles.map((p, i) => ({ p, i })).filter(({ p }) => p.profile_routing.affects_cultural_profile).map(({ i }) => i);
  const utilityIndices = profiles.map((p, i) => ({ p, i })).filter(({ p }) => p.profile_routing.affects_utility_profile).map(({ i }) => i);

  let visualProfile: VisualProfile | null = null;
  let culturalProfile: CulturalProfile | null = null;
  let utilityProfile: UtilityProfile | null = null;
  let psychology: Omit<TastePsychologyV4, "guardrails"> | null = null;
  let masterSummary: MasterSummary | null = null;

  if (key && profiles.length > 0) {
    const client = new OpenAI({ apiKey: key });

    // Run visual, cultural, utility, psychology in parallel; master summary separately after
    const vpRaw = visualIndices.length >= 1
      ? await llmJson<VisualProfile>(VISUAL_PROFILE_PROMPT, `${visualIndices.length} visual items:\n\n${serializeItems(profiles, visualIndices)}`, client, 900)
      : null;
    const cpRaw = culturalIndices.length >= 1
      ? await llmJson<CulturalProfile>(CULTURAL_PROFILE_PROMPT, `${culturalIndices.length} cultural items:\n\n${serializeItems(profiles, culturalIndices)}`, client, 700)
      : null;
    const upRaw = utilityIndices.length >= 1
      ? await llmJson<Omit<UtilityProfile, "should_not_contaminate_visual_profile">>(UTILITY_PROFILE_PROMPT, `${utilityIndices.length} utility items:\n\n${serializeItems(profiles, utilityIndices)}`, client, 500)
      : null;
    const psRaw = profiles.length >= 4
      ? await llmJson<Omit<TastePsychologyV4, "guardrails">>(PSYCHOLOGY_PROMPT, `${profiles.length} items total:\n\n${serializeItems(profiles, profiles.map((_, i) => i))}`, client, 1000)
      : null;

    visualProfile = vpRaw ?? (visualIndices.length ? fallbackVisualProfile(profiles, visualIndices) : null);
    culturalProfile = cpRaw ?? (culturalIndices.length ? fallbackCulturalProfile(profiles, culturalIndices) : null);
    utilityProfile = upRaw ? { ...upRaw, should_not_contaminate_visual_profile: true as const } : (utilityIndices.length ? fallbackUtilityProfile(profiles, utilityIndices) : null);
    psychology = psRaw ?? fallbackPsychology(profiles);

    const msRaw = profiles.length > 0
      ? await llmJson<MasterSummary>(MASTER_SUMMARY_PROMPT, [
          visualProfile ? `Visual: ${visualProfile.summary_short}` : "",
          culturalProfile ? `Cultural: ${culturalProfile.summary_short}` : "",
          `${profiles.length} total saves, ${visualIndices.length} visual-routed, ${utilityIndices.length} utility-routed`,
        ].filter(Boolean).join("\n"), client, 400)
      : null;
    masterSummary = msRaw ?? null;
  } else {
    visualProfile = visualIndices.length ? fallbackVisualProfile(profiles, visualIndices) : null;
    culturalProfile = culturalIndices.length ? fallbackCulturalProfile(profiles, culturalIndices) : null;
    utilityProfile = utilityIndices.length ? fallbackUtilityProfile(profiles, utilityIndices) : null;
    psychology = fallbackPsychology(profiles);
  }

  const saveBehavior = buildSaveBehavior(profiles);

  if (!masterSummary) {
    masterSummary = {
      profile_summary_short: visualProfile?.summary_short ?? `Current saves contain ${profiles.length} items across ${new Set(profiles.map(p => p.domain)).size} domains.`,
      profile_summary_rich: [
        visualProfile?.summary_short ?? "",
        culturalProfile?.summary_short ?? "",
        `${utilityIndices.length} utility saves should not affect aesthetic inference.`,
      ].filter(Boolean).join(" "),
      confidence: 0.5,
      vector_ready_text: [
        visualProfile?.vector_ready_text ?? "",
        culturalProfile?.vector_ready_text ?? "",
      ].filter(Boolean).join("; "),
    };
  }

  const tastePsychology: TastePsychologyV4 | null = psychology
    ? { guardrails: { non_clinical: true, non_diagnostic: true, inference_only_from_saved_links: true, explicitly_uncertain: true }, ...psychology }
    : null;

  const domains = new Set(profiles.map(p => p.domain));

  // Return in AiMasterProfile shape for export-payload backward compat
  return {
    schema_version: 1,
    user_slug: userSlug,
    generated_at: new Date().toISOString(),
    taste_summary_paragraph: masterSummary.profile_summary_short,
    top_themes: (visualProfile?.recurring_visual_signals ?? []).slice(0, 6).map((s, i) => ({ label: s.label, weight: 6 - i })),
    top_aesthetics: (visualProfile?.recurring_visual_signals ?? []).slice(0, 6).map((s, i) => ({ label: s.label, weight: 6 - i })),
    content_type_breakdown: Object.fromEntries(
      Array.from(new Set(profiles.map(p => p.item_kind))).map(k => [k, profiles.filter(p => p.item_kind === k).length])
    ),
    clusters: (visualProfile?.recurring_visual_signals ?? []).slice(0, 4).map(s => ({
      id: s.label.replace(/\s+/g, "_"),
      label: s.label,
      link_ids: s.evidence_item_indices.map(i => linkIds[i]).filter(Boolean),
    })),
    representative_link_ids: linkIds.slice(0, 5),
    aggregate_stats: {
      total_items: profiles.length,
      unique_domains: domains.size,
      providers: Object.fromEntries(
        Array.from(new Set(profiles.map(p => p.source_kind))).map(k => [k, profiles.filter(p => p.source_kind === k).length])
      ),
    },
    semantic_overview: masterSummary.vector_ready_text,
    saved_items: profiles,
    visual_profile: visualProfile,
    cultural_profile: culturalProfile,
    utility_profile: utilityProfile,
    save_behavior_profile: saveBehavior,
    taste_psychology: tastePsychology,
    master_summary: masterSummary,
  } as AiMasterProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown export
// ─────────────────────────────────────────────────────────────────────────────

export function masterProfileToMarkdown(
  m: AiMasterProfile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _linkIds: string[]
): string {
  const ms = m.master_summary;
  const vp = m.visual_profile;
  const cp = m.cultural_profile;
  const up = m.utility_profile;
  const sb = m.save_behavior_profile;
  const tp = m.taste_psychology;

  const lines = [
    `# Taste Dossier v4 — ${m.user_slug}`,
    `_Generated: ${m.generated_at} | Items: ${m.aggregate_stats.total_items}_`,
    ``,
  ];

  if (ms) {
    lines.push(`## Master Summary`, ``, ms.profile_summary_rich, `_Confidence: ${ms.confidence.toFixed(2)}_`, ``);
  }

  if (vp) {
    lines.push(`## Visual Profile`, ``, vp.summary_short, ``);
    if (vp.recurring_visual_signals.length) {
      lines.push(`### Recurring visual signals`);
      for (const s of vp.recurring_visual_signals) {
        lines.push(`- **${s.label}** — strength ${s.strength.toFixed(2)}, conf ${s.confidence.toFixed(2)}, ${s.coverage_count} items [${s.evidence_item_indices.join(",")}]`);
      }
    }
    if (vp.repeated_moods.length) lines.push(``, `**Moods:** ${vp.repeated_moods.join(", ")}`);
    if (vp.likely_visual_likes_more_of.length) {
      lines.push(``, `**Would like more of:**`);
      vp.likely_visual_likes_more_of.forEach(s => lines.push(`- ${s}`));
    }
    lines.push(``, `_Visual confidence: ${vp.confidence.toFixed(2)}_`, ``);
  }

  if (cp) {
    lines.push(`## Cultural Profile`, ``, cp.summary_short, ``);
    if (cp.core_attraction.length) lines.push(`**Core attraction:** ${cp.core_attraction.join(", ")}`, ``);
    if (cp.likely_dislikes.length) lines.push(`**Evidence-backed dislikes:** ${cp.likely_dislikes.join(", ")}`, ``);
  }

  if (up) {
    lines.push(`## Utility Profile`, ``, up.summary_short, ``);
    lines.push(`> ⚠️ These saves should NOT affect visual/aesthetic profile inference.`, ``);
  }

  if (sb) {
    lines.push(`## Save Behavior`, ``, sb.summary_short, ``);
    const top = sb.save_intent_distribution.slice(0, 4);
    lines.push(`**Intent distribution:** ${top.map(e => `${e.intent}(${e.count})`).join(", ")}`, ``);
  }

  if (tp) {
    lines.push(`## Taste Psychology`, ``, `> ⚠️ Non-clinical, non-diagnostic, inference only. Explicitly uncertain.`, ``);
    for (const t of tp.trait_hypotheses) {
      lines.push(`- **${t.label}**: ${t.estimated_level.toFixed(2)} (conf ${t.confidence.toFixed(2)}) — ${t.evidence.join("; ")}`);
    }
    lines.push(``);
    if (tp.persona_blend.length) {
      lines.push(`**Persona blend:**`);
      tp.persona_blend.forEach(p => lines.push(`- ${p.persona} (${(p.weight * 100).toFixed(0)}%) — ${p.description}`));
      lines.push(``);
    }
  }

  lines.push(`---`, `_See JSON export for full v4 dossier with all item-level layers._`);
  return lines.join("\n");
}
