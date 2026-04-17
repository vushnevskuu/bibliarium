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

const AGGREGATION_SYSTEM = `Optimize for correctness and taste discrimination, not for sounding insightful.
Prefer sparse, testable labels over narrative. If two labels would cluster together for most curators, merge them; if they split real variance here, keep both. When evidence is thin, return fewer keys with lower scores — never pad to sound clever.`;

const VISUAL_PROFILE_PROMPT = `Build a visual taste profile from these visual-routed items. Goal: discriminate this board from generic "design inspiration" noise — not to impress a reader.

STRICT RULES:
1. Prefix summary_short with "Current saves suggest..." — no "this person is/has/shows"
2. recurring_visual_signals: ONLY if evidence_item_indices has 2+ DISTINCT indices. Never 1.
3. Each signal "label" must be a short **discriminative** tag or noun phrase (≤8 words), grounded in shared execution/palette/layout cues — not a thesis.
4. strength/confidence must track evidence: 2 items → confidence <= 0.52; 3+ items → confidence <= 0.72
5. Profile "confidence": mean of recurring signal confidences if any; else 0.22–0.30
6. likely_visual_likes_more_of: concrete visual **formats** (e.g. "high-contrast flat illustration, few colors"), not virtues or lifestyle words
7. Do not infer humor/meme motive from odd subjects; prefer execution_read / stylistic_signals over depicted nouns
8. FORBIDDEN as recurring_visual_signals labels unless 3+ DISTINCT evidence indices AND the label names a visible graphic device (not a cause/topic):
   recycled / recycling / sustainability / eco / circular / upcycling / carbon / climate / "materials innovation" / packaging-as-topic / vague buckets like "mixed media design", "contemporary design", "visual storytelling"
9. PREFERRED recurring labels (concrete, recommendation-useful): authored / non-template graphic culture, rough-vs-polished balance, linework & contour quality, graphic attitude, odd-but-controlled imagery with character, low-polish intentional, subcultural / indie / internet-native feel, poster-like / editorial / zine-like / graphic-reference qualities, illustration energy — each tied to evidence indices
10. BANNED weak abstractions (never as labels or in summary): "low authorship", "high authorship" as standalone, "inventory-like", "inventory tone", "mixed polish aesthetic", "mixed polish", "unique visual styles", "visual representation", "mixed inspiration", "visual references" without a graphic modifier, "low information density" alone, any label that would NOT help pick the next reference image
11. RECOMMENDATION TEST: each recurring_visual_signals.label must answer "what would we search for next?" — if not, omit it.
12. NO SINGLE-CREATOR SPINE: never let one proper-named director/artist/designer become the center of recurring_visual_signals or summary_short. Named figures may appear only inside a label that foregrounds SHARED graphic execution (e.g. "high-contrast film-still grammar, formalist composition") or stays item-local — not "Kira Muratova" / "X and Y" alone as a board-level recurring label.
13. Prefer compressing items into recurring GRAPHIC MECHANICS (linework energy, crop, type, grain, attitude) over biography or catalogue-of-names.
14. vector_ready_text: same as recurring — no bare proper-name pairs without a graphic/stylistic anchor token.
15. Banned filler words: unique, creative vision, meaningful, journey, resonates, soulful, iconic, curated, deep narrative, innovation (unless literal in inputs)
16. Thin evidence → fewer signals, lower confidence, shorter summary
17. No personality language

OUTPUT valid JSON:
{
  "summary_short": "1-2 sentences starting with 'Current saves suggest...' Stress recurring graphic/stylistic co-occurrences (authored / non-template / graphic / rough-intentional / odd-with-character / subcultural surface / linework energy). Do not center on one creator name.",
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
  "vector_ready_text": "semicolon-separated recurring labels and axes; minimal prose"
}`;

const CULTURAL_PROFILE_PROMPT = `Build a cultural-routing profile from these items. Optimize for discrimination between items, not for sounding insightful.

STRICT RULES:
1. "Current saves suggest..." — never "this person is/has/tends to"
2. core_attraction: only if 2+ items share a checkable theme. Else leave empty.
3. recurring_patterns: 2+ DISTINCT indices per pattern; omit single-item "patterns"
4. Do not center recurring_patterns on a lone proper-named creator, film, or artwork unless 3+ DISTINCT evidence_item_indices clearly share that exact cluster; prefer era/movement/venue/channel language when evidence is thinner
5. likely_dislikes: only with explicit counter-evidence across items; else []
6. No deficits, limits, or psycho-moral reads
7. confidence ≈ average of pattern confidences when patterns exist; else low
8. Thin evidence → fewer patterns, lower confidence; no filler tropes (sustainability, "deep stories", innovation clichés)

OUTPUT valid JSON:
{
  "summary_short": "1-2 sentences. Dry inventory tone. 'Current saves suggest...'.",
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

const UTILITY_PROFILE_PROMPT = `Inventory utility/tool-routed items. Correctness over flair: short labels, evidence indices, no "user is" language.

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

const PSYCHOLOGY_PROMPT = `Optional weak trait estimates — calibration over insight. Do not impress the reader.

ALLOWED traits (ONLY these four, spelled exactly):
openness_to_experience, aesthetic_engagement, independence_of_taste, novelty_seeking

ABSOLUTE GUARDRAILS:
- NOT diagnosis, NOT clinical, NOT MBTI, NOT personality test
- No mental health, trauma, intelligence, attachment, political claims
- DO NOT produce negative conclusions about the user
- Each trait requires coverage_item_indices with >= 3 DISTINCT items from the board; otherwise OMIT the trait entirely
- Max 2 traits total. confidence per trait must be <= 0.42 unless >= 5 supporting items (then <= 0.52)
- estimated_level must be <= 0.65 for all traits
- Omit persona_blend entirely (return []) unless you have 4+ items with clear, redundant evidence
- When evidence is thin: return empty trait_hypotheses
- For any emitted trait: estimated_level and confidence must each be > 0.08 (use OMIT instead of emitting zeros)
- NEVER emit low openness_to_experience or low aesthetic_engagement from sparse data, mixed routing, or "conservative curation" guesses — when evidence is ambiguous, OMIT those traits entirely instead of downward estimates

OUTPUT valid JSON:
{
  "trait_hypotheses": [
    { "trait": "openness_to_experience", "label": "Openness (aesthetic)", "estimated_level": 0.35, "confidence": 0.32, "evidence": ["...", "..."], "coverage_item_indices": [] }
  ],
  "persona_blend": [],
  "confidence": 0.0,
  "vector_ready_text": "one short dry line or empty string"
}`;

const MASTER_SUMMARY_PROMPT = `Merge the given profile fragments into a master summary. Correctness and discrimination beat literary quality.

Inputs: visual profile summary, cultural profile summary, utility profile notes, save behavior data.

RULES:
1. profile_summary_short: 1-2 sentences, "Current saves suggest..." — lead with recurring graphic/stylistic language from the visual fragment; no thesis, no "inventory" framing, no "visual representation" / "mixed inspiration" / "unique visual styles"
2. profile_summary_rich: 3-4 short sentences max; each sentence must map to an input fragment (visual / cultural / utility split). Drop any clause you cannot trace to inputs.
   - Visual lane = style/execution/palette/composition patterns only — never merge utility tool names into visual language
   - Do not open with or over-weight a single proper-named creator unless the cultural fragment shows 3+ items backing that cluster; prefer authored / non-template / graphic / odd-character / signal-rich visual language for the visual sentence
   - If Psychology input says NONE, write zero sentences about personality, tendencies, or "openness"
   - No "creative person", no sustainability/deep narrative/innovation filler unless literal in inputs
   - No person evaluation (narrow/limited/lacks/disconnects)
   - No personality leaps
3. vector_ready_text: dense keyword line; semicolons; minimal adjectives — prioritize visual recurring labels over proper names
4. confidence: MUST be >0 and consistent with how specific the inputs are — if Psychology is NONE, keep confidence <= 0.55 unless visual+cultural fragments are very dense; if the visual fragment has no recurring_visual_signals, do not imply high specificity

OUTPUT valid JSON:
{
  "profile_summary_short": "...",
  "profile_summary_rich": "...",
  "confidence": 0.0,
  "vector_ready_text": "..."
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Routing + label hygiene (visual language, not subject topics)
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_TOPIC_VISUAL_RE =
  /recycl|sustainab|eco[\s-]?|circular\b|upcycl|carbon\b|climate\b|biodegrad|zero[\s-]?waste|green\b|packaging\s+innov|materials?\s+science|csr\b|esg\b/i;

const VAGUE_AGGREGATE_RE =
  /mixed\s*media\s*design|\bmixed\s*media\b(?!\s+collage)|\bcontemporary\s+design\b|\bvisual\s+storytelling\b|unique\s+aesthetic|creative\s+vision|^design$|\bmixed\s+inspiration\b|\bvisual\s+representation\b/i;

/** Profile / LLM noise that reads as critique or empty abstraction — drop from signals + summaries */
const BANNED_WEAK_PROFILE_LABEL_RE =
  /\b(low|high)\s+authorship\b|authorship-surface-low|inventory[-\s]?like|inventory\s+tone|mixed\s+polish|polish\s+aesthetic\b|generic\s+unique|unique\s+visual\s+styles?\b|\bvisual\s+representation\b|\bmixed\s+inspiration\b|\bvisual\s+references?\b(?!\s+(with|showing|using|in\s))|low\s+openness|openness\s*\(?low|aesthetic\s+experience\s*\(?low|low-value|weak\s+abstraction/i;

/** If a recurring label already encodes graphic/stylistic language, do not treat as "name-only center" */
const GRAPHIC_LANGUAGE_IN_RECURRING_RE =
  /linework|contour|palette|halftone|grain|illustration|poster|editorial|zine|risograph|riso|collage|vector|flat|high-contrast|internet-native|subcultural|indie|graphic|authored|non-template|anti-template|lo-fi|rough|vernacular|odd|controlled|hand|ink|brush|texture|composition|typograph|letterform|cinematic|film-still|film\s+still|still\b|frame|layout|montage|cut-?out|mixed-media|figure[-\s]?ground|signal-rich|character\b|energy|attitude|culture-forward|formalist|expressionist|surreal|vernacular|editorial/i;

const LEADING_INTEREST_PHRASE_RE =
  /^(?:interest|attraction|affinity|drawn|draw|saves?|saving|focus|centering|centered\s+on|references?\s+to|tribute\s+to|fandom|fan\s+of)\s+(?:in|on|to|toward|towards)?\s*/i;

/** Avoid false positives: magazines, cities, orgs */
const NAME_CLUSTER_STOPWORDS = new Set([
  "new", "los", "las", "san", "the", "van", "von", "de", "la", "le", "da", "del", "st",
  "york", "yorker", "times", "post", "street", "avenue", "press", "books", "media", "group",
  "studios", "records", "foundation", "museum", "gallery", "festival", "week", "science", "atlantic",
]);

function stripLeadingInterestPhrase(label: string): string {
  return label.replace(LEADING_INTEREST_PHRASE_RE, "").trim();
}

/**
 * True when the label reads as a proper-name / biography spine without anchoring graphic language
 * (e.g. "Kira Muratova", "David Lynch retrospectives" without execution tokens).
 */
function labelIsProperNameOrBiographyCenter(label: string): boolean {
  const core = stripLeadingInterestPhrase(label);
  if (GRAPHIC_LANGUAGE_IN_RECURRING_RE.test(core)) return false;
  const words = core.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  const lower = words.map(w => w.replace(/['’]s$/i, "").toLowerCase());
  if (lower.some(w => NAME_CLUSTER_STOPWORDS.has(w))) return false;
  if (/\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/.test(core)) return true;
  if (/\b[А-ЯЁ][а-яё]{2,}\s+[А-ЯЁ][а-яё]{2,}\b/.test(core)) return true;
  if (/\b(film|cinema|movie|director|artist|designer|photographer)\b/i.test(core)) {
    return /\b[A-Z][a-z]{2,}\b/.test(core) || /\b[А-ЯЁ][а-яё]{2,}\b/.test(core);
  }
  return false;
}

function culturalCoreLooksLikeLoneFigure(s: string): boolean {
  if (!labelIsProperNameOrBiographyCenter(s)) return false;
  return !/\b(movement|wave|school|cinema|film|scene|era|collective|festival|label|gallery|arthouse|documentary)\b/i.test(s);
}

function isBannedWeakProfileLabel(label: string): boolean {
  return BANNED_WEAK_PROFILE_LABEL_RE.test(label);
}

/** Labels must help pick the next reference (graphic/stylistic), not audit tone */
function passesRecommendationUsefulness(label: string): boolean {
  const L = label.trim().toLowerCase();
  if (L.length < 8) return false;
  if (isBannedWeakProfileLabel(L)) return false;
  const concrete =
    /linework|contour|palette|halftone|grain|illustration|poster|editorial|zine|risograph|riso|collage|vector|raster|flat|high-contrast|internet-native|subcultural|indie|graphic|composition|crop|type|slug|typograph|letterform|authored|non-template|anti-template|lo-fi|raw|rough|vernacular|odd|controlled|strange|character|hand|ink|brush|figure|ground|reference|material|texture|layered|maximal|minimal|brutal|energy|surface|attitude|cropped|still|frame|lighting|symmetr|asymmetr|intentional|signal-rich/i;
  if (concrete.test(L)) return true;
  const words = L.split(/\s+/).length;
  return (words >= 3 && L.length >= 22) || (words >= 2 && L.length >= 28);
}

function isTopicSubjectVisualLabel(s: string): boolean {
  return SUBJECT_TOPIC_VISUAL_RE.test(s);
}

function isVagueAggregateLabel(s: string): boolean {
  const t = s.trim();
  if (t.length < 4) return true;
  return VAGUE_AGGREGATE_RE.test(s);
}

/** Items that may shape the aesthetic aggregate — excludes weak aesthetic weight and tool lane */
function strictVisualEligible(p: SavedItemV4): boolean {
  if (!p.profile_routing.affects_visual_profile) return false;
  if (!p.taste_interpretation.should_affect_aesthetic_profile) return false;
  if (p.item_kind === "tool") return false;
  const w = p.taste_interpretation.weight_in_aesthetic_aggregation ?? 0;
  if (w < 0.2) return false;
  const utilLane =
    p.relevance.utility_relevance >= 0.62 &&
    (p.save_intent.primary === "tool_for_future_use" ||
      p.save_intent.primary === "workflow_resource");
  if (utilLane && p.relevance.visual_taste_relevance < 0.58) return false;
  return true;
}

function visualLanguageSignalsForAggregate(item: SavedItemV4): string[] {
  const vl = item.visual_layer;
  const raw = [...(vl.stylistic_signals ?? []), ...(vl.emotional_tone ?? [])];
  const tags = raw.map(s => s.trim()).filter(s => s.length > 2);
  const out = tags.filter(s => !isTopicSubjectVisualLabel(s) && !isVagueAggregateLabel(s));
  const auth = vl.visual_authorship ?? 0;
  const odd = vl.visual_oddity ?? 0;
  if (auth >= 0.52) out.push("authored-graphic-surface");
  if (odd >= 0.52) out.push("visual-oddity-high");
  if (vl.polish_level === "raw" || vl.polish_level === "lo-fi") out.push("intentional-low-polish");
  if (vl.polish_level === "refined" || vl.polish_level === "highly-polished") out.push("polish-refined");
  const ex = vl.graphic_execution_read?.toLowerCase() ?? "";
  const styLower = [...(vl.stylistic_signals ?? [])].join(" ").toLowerCase();
  const blob = `${styLower} ${ex}`;
  if (/linework|contour|ink|brush|stroke|halftone|grain|collage|poster|type|letterform/i.test(ex)) {
    out.push("execution-led-graphic");
  }
  if (/linework|illustration|brush|ink|stroke|energy|expressive/i.test(blob)) out.push("linework-illustration-energy");
  if (/subcultural|indie|internet-native|underground|counterculture|club\s+culture/i.test(blob)) {
    out.push("subcultural-indie-surface");
  }
  return Array.from(new Set(out));
}

type SignalFilterOpts = { allowProperNameCenter?: boolean };

function filterSignalsAgainstTopicAndVagueness(
  signals: EvidencedSignal[],
  opts?: SignalFilterOpts,
): EvidencedSignal[] {
  const allowName = opts?.allowProperNameCenter === true;
  return signals.filter(s => {
    const L = s.label;
    if (isVagueAggregateLabel(L)) return false;
    if (isBannedWeakProfileLabel(L)) return false;
    if (!allowName && labelIsProperNameOrBiographyCenter(L)) return false;
    if (isTopicSubjectVisualLabel(L)) {
      const uniq = new Set(s.evidence_item_indices ?? []).size;
      return uniq >= 3 && (s.coverage_count ?? uniq) >= 3;
    }
    return true;
  });
}

function filterCulturalRecurringPatterns(patterns: EvidencedSignal[]): EvidencedSignal[] {
  return (patterns ?? []).filter(p => {
    const L = p.label;
    if (isVagueAggregateLabel(L)) return false;
    if (isBannedWeakProfileLabel(L)) return false;
    const uniq = new Set(p.evidence_item_indices ?? []).size;
    if (labelIsProperNameOrBiographyCenter(L) && uniq < 3) return false;
    return true;
  });
}

function sanitizeCulturalProfile(cp: CulturalProfile): CulturalProfile {
  const patterns = filterCulturalRecurringPatterns(cp.recurring_patterns ?? []);
  const core = (cp.core_attraction ?? []).filter(
    s => !isBannedWeakProfileLabel(s) && !culturalCoreLooksLikeLoneFigure(s),
  );
  return {
    ...cp,
    summary_short: scrubBannedPhrasesFromText(cp.summary_short),
    recurring_patterns: patterns,
    core_attraction: core,
    vector_ready_text: scrubBannedPhrasesFromText(cp.vector_ready_text),
  };
}

function dedupeWeakVisualByLabel(weak: EvidencedSignal[]): EvidencedSignal[] {
  const out: EvidencedSignal[] = [];
  const seen = new Set<string>();
  for (const w of weak) {
    const k = w.label.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

function scrubBannedPhrasesFromText(text: string): string {
  let t = text;
  t = t.replace(/\binventory[-\s]?like\b/gi, "graphic");
  t = t.replace(/\bmixed\s+polish\b|\bmixed\s+polish\s+aesthetic\b/gi, "raw-versus-polished graphic balance");
  t = t.replace(/\blow\s+authorship\b/gi, "authored non-template graphics");
  t = t.replace(/\bvisual\s+representation\b/gi, "graphic read");
  t = t.replace(/\bmixed\s+inspiration\b/gi, "mixed graphic pulls");
  t = t.replace(/\bunique\s+visual\s+styles?\b/gi, "distinct graphic surfaces");
  t = t.replace(/\blow\s+openness\b|\bopenness\s*\(?low\b|\blow\s+openness\s+to\b/gi, "");
  t = t.replace(/\baesthetic\s+experience\s*\(?low\b/gi, "");
  t = t.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  return t;
}

function sanitizeVisualProfileCopy(vp: VisualProfile): VisualProfile {
  const recurring = filterSignalsAgainstTopicAndVagueness(vp.recurring_visual_signals ?? []);
  const weak = vp.weak_visual_hypotheses?.length
    ? filterSignalsAgainstTopicAndVagueness(vp.weak_visual_hypotheses, { allowProperNameCenter: true })
    : undefined;
  const likes = (vp.likely_visual_likes_more_of ?? []).filter(
    x => !isBannedWeakProfileLabel(x) && passesRecommendationUsefulness(x),
  );
  return {
    ...vp,
    summary_short: scrubBannedPhrasesFromText(vp.summary_short),
    recurring_visual_signals: recurring,
    weak_visual_hypotheses: weak?.length ? weak : undefined,
    likely_visual_likes_more_of: likes,
    vector_ready_text: scrubBannedPhrasesFromText(
      recurring.length ? recurring.map(s => s.label).join("; ") : vp.vector_ready_text,
    ),
  };
}

function serializeItemsForVisualAggregation(items: SavedItemV4[], indices: number[]): string {
  return indices.slice(0, 25).map(i => {
    const item = items[i];
    if (!item) return "";
    const vl = item.visual_layer;
    const parts = [
      `[${i}] domain=${item.domain} kind=${item.item_kind} intent=${item.save_intent.primary} aesthetic_weight=${item.taste_interpretation.weight_in_aesthetic_aggregation.toFixed(2)}`,
      `  NOTE: infer recurring VISUAL LANGUAGE only — not product topics, materials ethics, or utility purpose.`,
      `  NOTE: aggregate SHARED graphic mechanics (linework, grain, crop, type, attitude, odd-but-controlled) — not a catalogue of proper names; one-off biographical references stay weak/single-item only.`,
    ];
    if (vl.present) {
      parts.push(
        `  image_type=${vl.image_type} polish=${vl.polish_level} authorship_score=${(vl.visual_authorship ?? 0).toFixed(2)} oddity_score=${(vl.visual_oddity ?? 0).toFixed(2)} visual_conf=${(vl.confidence ?? 0).toFixed(2)}`,
      );
      if (vl.graphic_execution_read) parts.push(`  execution_read: ${vl.graphic_execution_read}`);
      if (vl.visual_attraction_hypothesis) parts.push(`  visual_attraction_read: ${vl.visual_attraction_hypothesis}`);
      if (vl.stylistic_signals.length) {
        parts.push(`  stylistic_signals: ${vl.stylistic_signals.filter(s => !isTopicSubjectVisualLabel(s)).join(", ")}`);
      }
      if (vl.emotional_tone?.length) parts.push(`  mood: ${vl.emotional_tone.join(", ")}`);
      if (vl.composition?.length) parts.push(`  composition: ${vl.composition.join(" | ")}`);
      if (vl.texture_materiality?.length) parts.push(`  texture_materiality: ${vl.texture_materiality.join(", ")}`);
    }
    return parts.filter(Boolean).join("\n");
  }).filter(Boolean).join("\n\n");
}

function serializeUtilityItemsOnly(items: SavedItemV4[], indices: number[]): string {
  return indices.slice(0, 25).map(i => {
    const item = items[i];
    if (!item) return "";
    return [
      `[${i}] domain=${item.domain} kind=${item.item_kind} intent=${item.save_intent.primary}`,
      `  utility_lane=true — describe tooling/workflow only; do not import visual-motif language from other saves.`,
      `  title: ${item.title ?? "n/a"}`,
      `  summary: ${item.semantic_layer.short_summary}`,
    ].join("\n");
  }).filter(Boolean).join("\n\n");
}

function alignMasterSummaryConfidence(
  ms: MasterSummary,
  vp: VisualProfile | null,
  psych: Omit<TastePsychologyV4, "guardrails"> | null,
): MasterSummary {
  let c = typeof ms.confidence === "number" && !Number.isNaN(ms.confidence) ? ms.confidence : 0.4;
  const rich = ms.profile_summary_rich ?? "";
  const hasPsychClaims = /\b(openness|novelty|aesthetic|personality|tend to|tends to|independent taste)\b/i.test(rich);
  if (!psych || psych.trait_hypotheses.length === 0) {
    if (hasPsychClaims) c = Math.min(c, 0.42);
    else c = Math.min(c, 0.52);
  } else {
    const traitMean =
      psych.trait_hypotheses.reduce((a, t) => a + (t.confidence ?? 0), 0) /
      Math.max(psych.trait_hypotheses.length, 1);
    if (hasPsychClaims) c = Math.max(c, traitMean * 0.85);
  }
  if (vp && vp.recurring_visual_signals.length > 0) {
    c = Math.max(c, vp.confidence * 0.72);
  } else if (vp && vp.recurring_visual_signals.length === 0) {
    c = Math.min(c, 0.48);
  }
  if (c <= 0.02 && rich.length > 40) c = vp?.confidence ?? 0.36;
  return { ...ms, confidence: parseFloat(Math.min(0.82, Math.max(0.24, c)).toFixed(2)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Item context serializer
// ─────────────────────────────────────────────────────────────────────────────

function serializeItems(items: SavedItemV4[], indices: number[]): string {
  return indices.slice(0, 25).map(i => {
    const item = items[i];
    if (!item) return "";
    const vl = item.visual_layer;
    const parts = [
      `[${i}] ${item.title ?? item.domain} | ${item.item_kind} | intent=${item.save_intent.primary}`,
      `  Summary: ${item.semantic_layer.short_summary}`,
    ];
    if (vl.present && vl.depicted_subject?.length) {
      parts.push(`  Depicted (subject): ${vl.depicted_subject.join(" | ")}`);
    }
    if (vl.present && vl.graphic_execution_read) {
      parts.push(`  Execution read: ${vl.graphic_execution_read}`);
    }
    if (vl.present && vl.visual_attraction_hypothesis) {
      parts.push(`  Visual attraction (non-subject): ${vl.visual_attraction_hypothesis}`);
    }
    if (vl.present && vl.stylistic_signals.length) {
      parts.push(`  Visual tokens: ${vl.stylistic_signals.join(", ")}`);
    }
    if (vl.emotional_tone?.length) {
      parts.push(`  Mood: ${vl.emotional_tone.join(", ")}`);
    }
    if (vl.composition?.length) parts.push(`  Composition: ${vl.composition.join(" | ")}`);
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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${AGGREGATION_SYSTEM}\n\n${prompt}` },
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
    const rawW = item.taste_interpretation.weight_in_aesthetic_aggregation ?? 0;
    const weight = rawW > 0 ? rawW : (item.profile_routing.affects_visual_profile ? 0.22 : 0.06);
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

const ALLOWED_PSYCH_TRAITS = new Set([
  "openness_to_experience",
  "aesthetic_engagement",
  "independence_of_taste",
  "novelty_seeking",
]);

/** Drop single-index "recurring" noise; keep 1-item reads in weak_visual_hypotheses only */
function partitionVisualSignalsFromLLM(vp: VisualProfile): VisualProfile {
  const recurring: EvidencedSignal[] = [];
  const weak: EvidencedSignal[] = [];
  for (const s of vp.recurring_visual_signals ?? []) {
    const n = new Set(s.evidence_item_indices ?? []).size;
    if (n >= 2) {
      recurring.push({
        ...s,
        coverage_count: Math.max(s.coverage_count, n),
        confidence: parseFloat(Math.min(s.confidence, n >= 4 ? 0.72 : 0.55).toFixed(2)),
        strength: parseFloat(Math.min(s.strength, n >= 4 ? 0.86 : 0.72).toFixed(2)),
      });
    } else if (n === 1) {
      weak.push({
        ...s,
        coverage_count: 1,
        confidence: parseFloat(Math.min(s.confidence, 0.35).toFixed(2)),
        strength: parseFloat(Math.min(s.strength, 0.3).toFixed(2)),
      });
    }
  }
  const recurringF = filterSignalsAgainstTopicAndVagueness(recurring);
  const namedDemoted = recurringF.filter(s => labelIsProperNameOrBiographyCenter(s.label));
  const recurringNoName = recurringF.filter(s => !labelIsProperNameOrBiographyCenter(s.label));
  const namedAsWeak: EvidencedSignal[] = namedDemoted.map(s => ({
    ...s,
    coverage_count: Math.min(s.coverage_count, new Set(s.evidence_item_indices ?? []).size),
    confidence: parseFloat(Math.min(s.confidence, 0.32).toFixed(2)),
    strength: parseFloat(Math.min(s.strength, 0.4).toFixed(2)),
  }));
  const weakF = dedupeWeakVisualByLabel([
    ...(weak.length ? filterSignalsAgainstTopicAndVagueness(weak, { allowProperNameCenter: true }) : []),
    ...namedAsWeak,
  ]);
  let summary_short = vp.summary_short;
  if (recurringNoName.length === 0 && weakF.length > 0 && !/2\+|two or more|cross-item|insufficient|not established/i.test(summary_short)) {
    summary_short =
      "Current saves include visually distinctive items, but no cross-item visual pattern clears the 2-item evidence bar yet.";
  }
  const next: VisualProfile = {
    ...vp,
    summary_short,
    recurring_visual_signals: recurringNoName,
    weak_visual_hypotheses: weakF.length ? weakF : undefined,
  };
  return coerceAndSanitizeVisual(next);
}

/** Heuristic LLM fallback — same hygiene as partitioned LLM output */
function coerceAndSanitizeVisual(vp: VisualProfile): VisualProfile {
  return coerceVisualProfileConfidence(sanitizeVisualProfileCopy(vp));
}

function coerceVisualProfileConfidence(vp: VisualProfile): VisualProfile {
  const raw = typeof vp.confidence === "number" && !Number.isNaN(vp.confidence) ? vp.confidence : 0;
  const recurring = vp.recurring_visual_signals;
  const weak = vp.weak_visual_hypotheses ?? [];
  let c = raw;

  if (recurring.length > 0) {
    const meanSig =
      recurring.reduce((a, s) => a + s.confidence, 0) / recurring.length;
    const fromSignals = profileConfidenceFromSignals(recurring);
    c = Math.max(meanSig * 0.96, fromSignals * 0.98, 0.32);
    c = Math.min(0.72, c);
    if (recurring.length >= 3) c = Math.min(0.78, Math.max(c, meanSig));
    c = Math.min(c, Math.max(raw, meanSig) + 0.06);
  } else if (weak.length > 0) {
    const wm = weak.reduce((a, s) => a + s.confidence, 0) / weak.length;
    c = Math.min(0.32, Math.max(0.22, wm * 0.88, raw * 0.9));
  } else {
    c = Math.min(0.3, Math.max(0.22, raw * 0.88));
  }

  return { ...vp, confidence: parseFloat(Math.min(0.88, c).toFixed(2)) };
}

function normalizePsychology(
  ps: Omit<TastePsychologyV4, "guardrails"> | null,
  itemCount: number,
): Omit<TastePsychologyV4, "guardrails"> | null {
  if (!ps) return null;
  const traits = ps.trait_hypotheses
    .filter(t => ALLOWED_PSYCH_TRAITS.has(t.trait))
    .map(t => {
      const cov = new Set(t.coverage_item_indices ?? []).size;
      if (cov < 3) return null;
      const el0 = typeof t.estimated_level === "number" && !Number.isNaN(t.estimated_level) ? t.estimated_level : null;
      const cf0 = typeof t.confidence === "number" && !Number.isNaN(t.confidence) ? t.confidence : null;
      if (
        (cf0 === null || cf0 <= 0.04) &&
        (el0 === null || el0 <= 0.04)
      ) {
        return null;
      }
      const elRaw = el0 ?? 0.22;
      if (
        (t.trait === "openness_to_experience" || t.trait === "aesthetic_engagement") &&
        elRaw < 0.42 &&
        (itemCount < 8 || cov < 5)
      ) {
        return null;
      }
      const el = Math.min(0.64, Math.max(0.16, elRaw));
      const cf = Math.min(cov >= 5 ? 0.5 : 0.42, Math.max(0.24, cf0 ?? 0.28));
      return {
        ...t,
        estimated_level: parseFloat(el.toFixed(2)),
        confidence: parseFloat(cf.toFixed(2)),
        evidence: t.evidence.slice(0, 3),
      };
    })
    .filter(Boolean) as TraitHypothesis[];
  const traitOut = traits.slice(0, 2);
  const persona = itemCount >= 6 ? (ps.persona_blend ?? []).slice(0, 2) : [];
  if (traitOut.length === 0 && persona.length === 0) return null;
  const conf = traitOut.length
    ? parseFloat((traitOut.reduce((s, t) => s + t.confidence, 0) / traitOut.length).toFixed(2))
    : 0.28;
  return {
    trait_hypotheses: traitOut,
    persona_blend: persona,
    confidence: Math.min(0.55, Math.max(0.24, conf)),
    vector_ready_text: traitOut.length
      ? traitOut.map(t => `${t.trait}~${t.estimated_level.toFixed(2)}`).join("; ")
      : ps.vector_ready_text?.slice(0, 200) ?? "",
  };
}

function fallbackVisualProfile(items: SavedItemV4[], indices: number[]): VisualProfile {
  // Require 2+ items for a signal to appear in the profile — single-item signals stay local
  const recurring = countWeightedSignals(items, indices, i => visualLanguageSignalsForAggregate(i), 2);
  const moods = countWeightedSignals(
    items,
    indices,
    i => (i.visual_layer.emotional_tone ?? []).filter(m => !isTopicSubjectVisualLabel(m)),
    2,
  );
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
  if (items.length < 5) return null;
  const visualItems = items.filter(i => strictVisualEligible(i));
  if (visualItems.length < 3) return null;
  const avgOddity = visualItems.reduce((s, i) => s + i.visual_layer.visual_oddity, 0) / Math.max(visualItems.length, 1);
  const avgAuth = visualItems.reduce((s, i) => s + i.visual_layer.visual_authorship, 0) / Math.max(visualItems.length, 1);
  const visualIndices = visualItems.map(i => i.item_index).slice(0, 6);

  const traits: TraitHypothesis[] = [];
  if (visualIndices.length >= 3 && avgAuth > 0.42) {
    traits.push({
      trait: "aesthetic_engagement",
      label: "Aesthetic engagement",
      estimated_level: parseFloat(Math.min(0.62, avgAuth).toFixed(2)),
      confidence: 0.38,
      evidence: [
        `${visualIndices.length} saves route to the visual profile with non-template execution signals`,
      ],
      coverage_item_indices: visualIndices.slice(0, 5),
    });
  }
  if (visualIndices.length >= 3 && avgOddity > 0.48) {
    traits.push({
      trait: "novelty_seeking",
      label: "Novelty in visual selection",
      estimated_level: parseFloat(Math.min(0.6, avgOddity).toFixed(2)),
      confidence: 0.36,
      evidence: ["Oddity / non-mainstream visual scores recur across multiple routed items"],
      coverage_item_indices: visualIndices.slice(0, 5),
    });
  }
  if (traits.length === 0) return null;
  return {
    trait_hypotheses: traits.slice(0, 2),
    persona_blend: [],
    confidence: 0.35,
    vector_ready_text: traits.map(t => `${t.trait}~${t.estimated_level.toFixed(2)}`).join("; "),
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
  const visualIndicesAll = profiles.map((p, i) => ({ p, i })).filter(({ p }) => p.profile_routing.affects_visual_profile).map(({ i }) => i);
  const visualIndicesStrict = profiles.map((p, i) => ({ p, i })).filter(({ p }) => strictVisualEligible(p)).map(({ i }) => i);
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
    const vpRaw = visualIndicesStrict.length >= 1
      ? await llmJson<VisualProfile>(
          VISUAL_PROFILE_PROMPT,
          `${visualIndicesStrict.length} aesthetic-weighted visual items (visual-language fields only):\n\n${serializeItemsForVisualAggregation(profiles, visualIndicesStrict)}`,
          client,
          900,
        )
      : null;
    const cpRaw = culturalIndices.length >= 1
      ? await llmJson<CulturalProfile>(CULTURAL_PROFILE_PROMPT, `${culturalIndices.length} cultural items:\n\n${serializeItems(profiles, culturalIndices)}`, client, 700)
      : null;
    const upRaw = utilityIndices.length >= 1
      ? await llmJson<Omit<UtilityProfile, "should_not_contaminate_visual_profile">>(
          UTILITY_PROFILE_PROMPT,
          `${utilityIndices.length} utility items:\n\n${serializeUtilityItemsOnly(profiles, utilityIndices)}`,
          client,
          500,
        )
      : null;
    const psRaw = profiles.length >= 4
      ? await llmJson<Omit<TastePsychologyV4, "guardrails">>(PSYCHOLOGY_PROMPT, `${profiles.length} items total:\n\n${serializeItems(profiles, profiles.map((_, i) => i))}`, client, 1000)
      : null;

    visualProfile = vpRaw
      ? partitionVisualSignalsFromLLM(vpRaw)
      : visualIndicesStrict.length
        ? coerceAndSanitizeVisual(fallbackVisualProfile(profiles, visualIndicesStrict))
        : null;
    culturalProfile = cpRaw
      ? sanitizeCulturalProfile(cpRaw)
      : culturalIndices.length
        ? sanitizeCulturalProfile(fallbackCulturalProfile(profiles, culturalIndices))
        : null;
    utilityProfile = upRaw ? { ...upRaw, should_not_contaminate_visual_profile: true as const } : (utilityIndices.length ? fallbackUtilityProfile(profiles, utilityIndices) : null);
    psychology = normalizePsychology(psRaw ?? fallbackPsychology(profiles), profiles.length);

    const psychForMaster = psychology
      ? `Psychology (weak hypotheses; keep literal): ${JSON.stringify(psychology.trait_hypotheses)}`
      : "Psychology: NONE — do not mention personality, tendencies, openness, novelty, or aesthetic engagement as facts.";

    const msRaw = profiles.length > 0
      ? await llmJson<MasterSummary>(MASTER_SUMMARY_PROMPT, [
          visualProfile ? `Visual: ${visualProfile.summary_short}` : "Visual: none (no aesthetic-weighted items).",
          culturalProfile ? `Cultural: ${culturalProfile.summary_short}` : "",
          `Board: ${profiles.length} saves; aesthetic-visual lane=${visualIndicesStrict.length} items; loosely visual-routed=${visualIndicesAll.length}; utility=${utilityIndices.length}.`,
          psychForMaster,
        ].filter(Boolean).join("\n\n"), client, 480)
      : null;
    masterSummary = msRaw
      ? alignMasterSummaryConfidence(msRaw, visualProfile, psychology)
      : null;
  } else {
    visualProfile = visualIndicesStrict.length
      ? coerceAndSanitizeVisual(fallbackVisualProfile(profiles, visualIndicesStrict))
      : null;
    culturalProfile = culturalIndices.length
      ? sanitizeCulturalProfile(fallbackCulturalProfile(profiles, culturalIndices))
      : null;
    utilityProfile = utilityIndices.length ? fallbackUtilityProfile(profiles, utilityIndices) : null;
    psychology = normalizePsychology(fallbackPsychology(profiles), profiles.length);
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
    if (vp.weak_visual_hypotheses?.length) {
      lines.push(``, `### Weak visual hypotheses (single-item; not board-level)`);
      for (const s of vp.weak_visual_hypotheses) {
        lines.push(`- _${s.label}_ — conf ${s.confidence.toFixed(2)} [${s.evidence_item_indices.join(",")}]`);
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
