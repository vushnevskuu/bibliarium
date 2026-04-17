/**
 * Layer 3: Evidence-backed profile aggregation + non-clinical taste psychology.
 *
 * Design principles:
 * - Every claim has evidence_item_indices — no free-floating assertions
 * - Three tiers: strong_signals / emerging_signals / weak_hypotheses
 * - Language: "current saves suggest..." never "this person is..."
 * - likely_dislikes only when real evidence exists
 * - taste_psychology is probabilistic, explicitly non-clinical
 */

import OpenAI from "openai";
import type {
  AiMasterProfile,
  EvidencedClaim,
  ItemTasteProfile,
  ProfileAestheticAxes,
  TastePsychology,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Profile aggregation prompt
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_AGGREGATION_PROMPT = `You are building a machine-usable taste graph from analyzed saved links.

CRITICAL RULES:
1. Every claim MUST reference evidence_item_indices (which item indices support it)
2. Coverage = fraction of total items supporting the claim (0.0–1.0)
3. Use "current saves suggest..." or "save patterns indicate..." — NEVER "this person is..."
4. Three signal tiers:
   - strong_signals: 3+ items, confidence >= 0.7
   - emerging_signals: 2+ items, confidence 0.4–0.7
   - weak_hypotheses: 1 item or low confidence, < 0.4
5. Do NOT include likely_dislikes unless at least 2 items provide real counter-signal evidence
6. Do NOT include flattering generalities — only discriminative, evidence-grounded claims
7. Reject weak inferences rather than include them with low confidence
8. Platform names (twitter, youtube, etc.) must NEVER appear as taste signals
9. Render labels (open-graph-card, social-card, etc.) must NEVER appear

OUTPUT: Valid JSON only, no markdown:
{
  "strong_signals": [
    { "claim": "...", "evidence_item_indices": [0,2,4], "coverage": 0.3, "confidence": 0.8 }
  ],
  "emerging_signals": [
    { "claim": "...", "evidence_item_indices": [1,3], "coverage": 0.13, "confidence": 0.55 }
  ],
  "weak_hypotheses": [
    { "claim": "...", "evidence_item_indices": [5], "coverage": 0.07, "confidence": 0.3 }
  ],
  "visual_preferences": ["max 4, direct from item evidence only"],
  "conceptual_preferences": ["max 4"],
  "emotional_preferences": ["max 3"],
  "cultural_gravity": ["max 3, real cultural anchors evidenced by multiple items"],
  "preference_axes": {
    "mainstream_vs_niche": 0.0,
    "loud_vs_quiet": 0.0,
    "utility_vs_aesthetic": 0.0,
    "literal_vs_interpretive": 0.0,
    "clean_vs_textured": 0.0,
    "corporate_vs_independent": 0.0
  },
  "likely_dislikes": [],
  "likely_likes_more_of": ["4-6 items they would probably save — grounded in observed patterns"],
  "evidence_backed_clusters": [
    {
      "label": "short cluster name",
      "description": "what aesthetic/cultural pattern this cluster represents",
      "evidence_item_indices": [0, 2, 4],
      "strength": 0.0
    }
  ],
  "profile_summary_short": "2 sentences. Start with 'Current saves suggest...'. No flattery. Discriminative.",
  "profile_summary_rich": "3-4 sentences. Evidence-grounded. Probabilistic language. Machine-targeted.",
  "confidence": 0.0
}

Preference axes: -1 to +1. 0 = unclear. For mainstream_vs_niche: -1 = strongly niche.
Output confidence: reflects average evidence quality, not optimism.`;

// ─────────────────────────────────────────────────────────────────────────────
// Taste psychology prompt
// ─────────────────────────────────────────────────────────────────────────────

const TASTE_PSYCHOLOGY_PROMPT = `You are inferring non-clinical cognitive and aesthetic style tendencies from a collection of saved links.

ABSOLUTE GUARDRAILS — violating these makes the output useless:
- This is NOT diagnosis, NOT clinical psychology, NOT therapy
- Do NOT mention mental health, trauma, attachment style, anxiety, or any clinical condition
- Do NOT use MBTI types as the core framework
- Do NOT claim intelligence levels
- Do NOT claim political views
- Do NOT be flattering — be accurate and probabilistic
- LOWER confidence instead of overclaiming
- If evidence is sparse, output low confidence and short evidence lists
- Language must be explicitly hedged: "save patterns tentatively suggest...", "weakly indicated by..."

DIMENSIONS TO ANALYZE:
1. openness_to_experience — tolerance for novel, complex, ambiguous content
2. aesthetic_sensitivity — depth of visual/sensory discrimination in saves
3. need_for_cognition — preference for intellectually demanding content
4. tolerance_for_ambiguity — whether saves embrace or avoid unclear/open-ended content
5. novelty_seeking — recurring attraction to new/obscure/non-canonical sources
6. independence_of_taste — resistance to mainstream/algorithmic recommendations
7. identity_signaling_via_curation — whether saves seem to perform identity vs. private utility

For each dimension output:
- estimated_level: "high" | "moderate-high" | "moderate" | "low" | "unclear"
- confidence: 0.0–1.0 (be conservative)
- evidence: 2-3 specific observations from items
- coverage_item_indices: which items support it

Also output:
- persona_blend: 2-3 weighted archetypes (e.g. "curatorial aesthete", "independent researcher", "cultural omnivore") each with weight and 1-sentence rationale
- selection_style: 2-3 behavioral tendencies (e.g. curation_density, authorship_sensitivity) each with tendency description and evidence

OUTPUT: Valid JSON only:
{
  "trait_hypotheses": {
    "openness_to_experience": { "label": "Openness to Experience", "estimated_level": "...", "confidence": 0.0, "evidence": [], "coverage_item_indices": [] },
    "aesthetic_sensitivity": { "label": "Aesthetic Sensitivity", "estimated_level": "...", "confidence": 0.0, "evidence": [], "coverage_item_indices": [] },
    "need_for_cognition": { "label": "Need for Cognition", "estimated_level": "...", "confidence": 0.0, "evidence": [], "coverage_item_indices": [] },
    "tolerance_for_ambiguity": { "label": "Tolerance for Ambiguity", "estimated_level": "...", "confidence": 0.0, "evidence": [], "coverage_item_indices": [] },
    "novelty_seeking": { "label": "Novelty Seeking", "estimated_level": "...", "confidence": 0.0, "evidence": [], "coverage_item_indices": [] },
    "independence_of_taste": { "label": "Independence of Taste", "estimated_level": "...", "confidence": 0.0, "evidence": [], "coverage_item_indices": [] },
    "identity_signaling_via_curation": { "label": "Identity Signaling via Curation", "estimated_level": "...", "confidence": 0.0, "evidence": [], "coverage_item_indices": [] }
  },
  "persona_blend": [
    { "archetype": "...", "weight": 0.0, "rationale": "..." }
  ],
  "selection_style": [
    { "label": "...", "tendency": "...", "confidence": 0.0, "evidence": [] }
  ],
  "synthesis": "1-2 sentences. Hedged. Non-flattering. Evidence-grounded.",
  "confidence": 0.0
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildItemsContext(items: ItemTasteProfile[]): string {
  return items
    .slice(0, 35)
    .map((item, i) => {
      const parts: string[] = [
        `[${i}] ${item.title ?? item.domain} | ${item.source_kind}/${item.content_type} | conf=${item.confidence.toFixed(2)}`,
      ];
      if (item.short_summary) parts.push(`  Summary: ${item.short_summary}`);
      if (item.save_reason) parts.push(`  Save reason: ${item.save_reason}`);
      if (item.style_descriptors.length) parts.push(`  Style: ${item.style_descriptors.join(", ")}`);
      if (item.mood_descriptors.length) parts.push(`  Mood: ${item.mood_descriptors.join(", ")}`);
      if (item.appeal_signals.visual.length) parts.push(`  Visual: ${item.appeal_signals.visual.join("; ")}`);
      if (item.appeal_signals.conceptual.length) parts.push(`  Conceptual: ${item.appeal_signals.conceptual.join("; ")}`);
      if (item.appeal_signals.emotional.length) parts.push(`  Emotional: ${item.appeal_signals.emotional.join("; ")}`);
      if (item.cultural_references.length) parts.push(`  Cultural: ${item.cultural_references.join(", ")}`);
      if (item.interpretation.length) parts.push(`  Interpretation: ${item.interpretation.join(" ")}`);
      const ax = item.aesthetic_axes;
      const nonZero = Object.entries(ax).filter(([, v]) => Math.abs(v) > 0.2).map(([k, v]) => `${k}=${v.toFixed(1)}`);
      if (nonZero.length) parts.push(`  Axes: ${nonZero.join(", ")}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM calls
// ─────────────────────────────────────────────────────────────────────────────

interface LlmProfileResult {
  strong_signals: EvidencedClaim[];
  emerging_signals: EvidencedClaim[];
  weak_hypotheses: EvidencedClaim[];
  visual_preferences: string[];
  conceptual_preferences: string[];
  emotional_preferences: string[];
  cultural_gravity: string[];
  preference_axes: ProfileAestheticAxes;
  likely_dislikes: EvidencedClaim[];
  likely_likes_more_of: string[];
  evidence_backed_clusters: import("./types").EvidenceCluster[];
  profile_summary_short: string;
  profile_summary_rich: string;
  confidence: number;
}

async function aggregateProfileWithLlm(
  items: ItemTasteProfile[],
  client: OpenAI
): Promise<LlmProfileResult | null> {
  if (items.length === 0) return null;
  const context = buildItemsContext(items);
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1400,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROFILE_AGGREGATION_PROMPT },
        { role: "user", content: `${items.length} items total:\n\n${context}` },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as LlmProfileResult;
  } catch {
    return null;
  }
}

async function extractPsychologyWithLlm(
  items: ItemTasteProfile[],
  client: OpenAI
): Promise<Omit<TastePsychology, "disclaimer"> | null> {
  if (items.length < 4) return null; // not enough signal
  const context = buildItemsContext(items);
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TASTE_PSYCHOLOGY_PROMPT },
        { role: "user", content: `${items.length} items total:\n\n${context}` },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as Omit<TastePsychology, "disclaimer">;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic fallback
// ─────────────────────────────────────────────────────────────────────────────

function aggregateAxes(items: ItemTasteProfile[]): ProfileAestheticAxes {
  const src = items.filter(i => i.confidence >= 0.4);
  const base = src.length > 0 ? src : items;
  const avg = (key: keyof ItemTasteProfile["aesthetic_axes"]) => {
    const vals = base.map(i => i.aesthetic_axes[key]).filter(v => v !== 0);
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

function buildFallbackProfile(items: ItemTasteProfile[]): LlmProfileResult {
  // Collect weighted descriptor counts
  const styleMap = new Map<string, { score: number; indices: number[] }>();
  items.forEach((item, i) => {
    for (const d of [...item.style_descriptors, ...item.mood_descriptors]) {
      if (!d || d.length < 3) continue;
      const e = styleMap.get(d) ?? { score: 0, indices: [] };
      e.score += item.confidence;
      e.indices.push(i);
      styleMap.set(d, e);
    }
  });

  const topStyles = Array.from(styleMap.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 8);

  const strong: EvidencedClaim[] = topStyles
    .filter(([, e]) => e.indices.length >= 3)
    .slice(0, 3)
    .map(([claim, e]) => ({
      claim,
      evidence_item_indices: e.indices.slice(0, 5),
      coverage: e.indices.length / items.length,
      confidence: Math.min(0.7, e.score / items.length),
    }));

  const emerging: EvidencedClaim[] = topStyles
    .filter(([, e]) => e.indices.length === 2)
    .slice(0, 3)
    .map(([claim, e]) => ({
      claim,
      evidence_item_indices: e.indices,
      coverage: e.indices.length / items.length,
      confidence: 0.4,
    }));

  return {
    strong_signals: strong,
    emerging_signals: emerging,
    weak_hypotheses: [],
    visual_preferences: items.flatMap(i => i.appeal_signals.visual).slice(0, 4),
    conceptual_preferences: items.flatMap(i => i.appeal_signals.conceptual).slice(0, 4),
    emotional_preferences: items.flatMap(i => i.appeal_signals.emotional).slice(0, 3),
    cultural_gravity: [],
    preference_axes: aggregateAxes(items),
    likely_dislikes: [],
    likely_likes_more_of: [],
    evidence_backed_clusters: [],
    profile_summary_short: items.length === 0
      ? "No items saved yet."
      : `Current saves suggest interest in ${strong.map(s => s.claim).join(", ") || "mixed content"}. Insufficient data for reliable profiling.`,
    profile_summary_rich: `Save collection contains ${items.length} items across ${new Set(items.map(i => i.domain)).size} domains. Heuristic fallback — LLM key not configured.`,
    confidence: items.reduce((s, i) => s + i.confidence, 0) / Math.max(items.length, 1),
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
  let profileResult: LlmProfileResult | null = null;
  let psychologyResult: Omit<TastePsychology, "disclaimer"> | null = null;

  if (key && profiles.length > 0) {
    const client = new OpenAI({ apiKey: key });
    // Run both in parallel — psychology is independent
    [profileResult, psychologyResult] = await Promise.all([
      aggregateProfileWithLlm(profiles, client),
      extractPsychologyWithLlm(profiles, client),
    ]);
  }

  if (!profileResult) {
    profileResult = buildFallbackProfile(profiles);
  }

  const tasteSummary: import("./types").TasteProfileSummary = {
    strong_signals: profileResult.strong_signals ?? [],
    emerging_signals: profileResult.emerging_signals ?? [],
    weak_hypotheses: profileResult.weak_hypotheses ?? [],
    visual_preferences: profileResult.visual_preferences ?? [],
    conceptual_preferences: profileResult.conceptual_preferences ?? [],
    emotional_preferences: profileResult.emotional_preferences ?? [],
    cultural_gravity: profileResult.cultural_gravity ?? [],
    preference_axes: profileResult.preference_axes,
    likely_dislikes: profileResult.likely_dislikes ?? [],
    likely_likes_more_of: profileResult.likely_likes_more_of ?? [],
    evidence_backed_clusters: profileResult.evidence_backed_clusters ?? [],
    profile_summary_short: profileResult.profile_summary_short,
    profile_summary_rich: profileResult.profile_summary_rich,
    confidence: Math.max(0, Math.min(1, profileResult.confidence)),
    vector_ready_text: [
      `TASTE PROFILE: ${userSlug}`,
      profileResult.profile_summary_short,
      profileResult.strong_signals?.map(s => `STRONG: ${s.claim}`).join("\n") ?? "",
      profileResult.visual_preferences?.length ? `VISUAL: ${profileResult.visual_preferences.join("; ")}` : "",
      profileResult.conceptual_preferences?.length ? `CONCEPTUAL: ${profileResult.conceptual_preferences.join("; ")}` : "",
      profileResult.likely_dislikes?.length ? `AVOIDS: ${profileResult.likely_dislikes.map(d => d.claim).join("; ")}` : "",
    ].filter(Boolean).join("\n"),
  };

  const tastePsychology: TastePsychology | null = psychologyResult
    ? {
        disclaimer: "This section contains probabilistic inferences from saved links only. It is non-clinical, non-diagnostic, and explicitly uncertain. Do not treat any claim here as fact.",
        ...psychologyResult,
      }
    : null;

  const domains = new Set(profiles.map(p => p.domain));

  // AiMasterProfile shape for backward compat — also carry new fields
  return {
    schema_version: 1,
    user_slug: userSlug,
    generated_at: new Date().toISOString(),
    taste_summary_paragraph: profileResult.profile_summary_short,
    top_themes: profileResult.strong_signals.map((s, i) => ({ label: s.claim, weight: profileResult!.strong_signals.length - i })),
    top_aesthetics: profileResult.visual_preferences.map((label, i) => ({ label, weight: profileResult!.visual_preferences.length - i })),
    content_type_breakdown: Object.fromEntries(
      Array.from(new Set(profiles.map(p => p.content_type))).map(k => [k, profiles.filter(p => p.content_type === k).length])
    ),
    clusters: (profileResult.evidence_backed_clusters ?? []).map(c => ({
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
      profileResult.strong_signals?.length ? `Strong: ${profileResult.strong_signals.map(s => s.claim).join("; ")}` : "",
      profileResult.visual_preferences?.length ? `Visual: ${profileResult.visual_preferences.join("; ")}` : "",
      profileResult.likely_dislikes?.length ? `Avoids: ${profileResult.likely_dislikes.map(d => d.claim).join("; ")}` : "",
    ].filter(Boolean).join("\n"),
    saved_items: profiles as AiMasterProfile["saved_items"],
    // Carry new structures for export-payload
    ...(({ taste_summary: tasteSummary, taste_psychology: tastePsychology } as object)),
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
  const ts = (m as unknown as { taste_summary?: import("./types").TasteProfileSummary }).taste_summary;
  const tp = (m as unknown as { taste_psychology?: TastePsychology | null }).taste_psychology;

  const lines: string[] = [
    `# Taste dossier — ${m.user_slug}`,
    `_Generated: ${m.generated_at} | Items: ${m.aggregate_stats.total_items}_`,
    ``,
  ];

  if (ts?.profile_summary_rich) {
    lines.push(`## Summary`, ``, ts.profile_summary_rich, ``);
  }

  if (ts?.strong_signals?.length) {
    lines.push(`## Strong signals (multi-item backed)`);
    for (const s of ts.strong_signals) {
      lines.push(`- **${s.claim}** — coverage ${(s.coverage * 100).toFixed(0)}%, conf ${s.confidence.toFixed(2)}, items [${s.evidence_item_indices.join(",")}]`);
    }
    lines.push(``);
  }

  if (ts?.emerging_signals?.length) {
    lines.push(`## Emerging signals`);
    for (const s of ts.emerging_signals) {
      lines.push(`- ${s.claim} — conf ${s.confidence.toFixed(2)}, items [${s.evidence_item_indices.join(",")}]`);
    }
    lines.push(``);
  }

  if (ts?.weak_hypotheses?.length) {
    lines.push(`## Weak hypotheses (speculative)`);
    for (const s of ts.weak_hypotheses) {
      lines.push(`- _${s.claim}_ — conf ${s.confidence.toFixed(2)}, items [${s.evidence_item_indices.join(",")}]`);
    }
    lines.push(``);
  }

  if (ts?.visual_preferences?.length) {
    lines.push(`## Visual preferences`, ...ts.visual_preferences.map(s => `- ${s}`), ``);
  }

  if (ts?.likely_dislikes?.length) {
    lines.push(`## Evidence-backed dislikes`);
    for (const d of ts.likely_dislikes) {
      lines.push(`- ${d.claim} — conf ${d.confidence.toFixed(2)}, items [${d.evidence_item_indices.join(",")}]`);
    }
    lines.push(``);
  }

  if (ts?.likely_likes_more_of?.length) {
    lines.push(`## Would likely save more of`, ...ts.likely_likes_more_of.map(s => `- ${s}`), ``);
  }

  if (ts?.evidence_backed_clusters?.length) {
    lines.push(`## Taste clusters`);
    for (const c of ts.evidence_backed_clusters) {
      lines.push(`- **${c.label}** (${(c.strength * 100).toFixed(0)}%) — ${c.description} [${c.evidence_item_indices.join(",")}]`);
    }
    lines.push(``);
  }

  if (tp) {
    lines.push(
      `## Taste psychology`,
      ``,
      `> ⚠️ ${tp.disclaimer}`,
      ``,
    );
    const th = tp.trait_hypotheses;
    lines.push(`### Trait hypotheses`);
    for (const [, dim] of Object.entries(th)) {
      lines.push(`- **${dim.label}**: ${dim.estimated_level} (conf ${dim.confidence.toFixed(2)}) — ${dim.evidence.join("; ")}`);
    }
    lines.push(``);
    if (tp.persona_blend?.length) {
      lines.push(`### Persona blend`);
      for (const p of tp.persona_blend) {
        lines.push(`- **${p.archetype}** (${(p.weight * 100).toFixed(0)}%) — ${p.rationale}`);
      }
      lines.push(``);
    }
    if (tp.synthesis) {
      lines.push(`### Synthesis`, ``, tp.synthesis, ``);
    }
  }

  lines.push(`---`, `_See JSON export for full machine-readable item profiles with vector_ready_text._`);
  return lines.join("\n");
}
