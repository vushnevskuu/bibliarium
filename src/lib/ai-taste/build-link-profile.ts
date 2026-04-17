/**
 * Layer 2: Item-level taste extraction.
 *
 * Two modes:
 * 1. LLM mode — calls GPT-4o-mini with a structured prompt; returns rich ItemTasteProfile
 * 2. Fallback mode — heuristic rules; lower confidence; no platform/render labels
 */

import OpenAI from "openai";
import type {
  AestheticAxes,
  AppealSignals,
  ContentType,
  ItemTasteProfile,
  SourceKind,
  TasteRole,
  VisualAnalysisProfile,
} from "./types";

// ─── Normalization helpers ────────────────────────────────────────────────────

const PLATFORM_BLOCKLIST = new Set([
  "twitter","x","pinterest","telegram","youtube","instagram","tiktok",
  "readymag","substack","medium","notion","figma","dribbble","behance",
  "github","reddit","linkedin","facebook","vimeo","soundcloud",
]);

const RENDER_LABEL_BLOCKLIST = new Set([
  "web-landing","mixed-layout","open-graph-card","social-card","rich-embed",
  "thumbnail-led","conversation","messaging-ui","video-ui","embed","oembed",
  "og","fallback","web","article","image-forward","native-embed",
]);

function isGarbage(s: string): boolean {
  const normalized = s.toLowerCase().trim();
  return (
    PLATFORM_BLOCKLIST.has(normalized) ||
    RENDER_LABEL_BLOCKLIST.has(normalized) ||
    normalized.length < 3 ||
    /^\d+$/.test(normalized)
  );
}

function filterDescriptors(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    if (isGarbage(s) || seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

// ─── LLM extraction ───────────────────────────────────────────────────────────

const ITEM_EXTRACTION_PROMPT = `You are a taste analyst extracting latent aesthetic and cultural attraction signals from a saved link.

Your job is NOT to summarize the website. Your job is to infer WHY someone with taste might have saved this link and what it signals about their aesthetic preferences.

STRICT RULES:
- Do NOT output platform names (twitter, youtube, pinterest, instagram, telegram, etc.) as themes or taste signals
- Do NOT output render/card type labels (social-card, open-graph-card, web-landing, mixed-layout, etc.) as aesthetics
- Do NOT output random title tokens or person names unless they represent a real recurring cultural anchor
- DO infer latent attraction signals: editorial aesthetic, cinematic quality, material texture, cultural positioning, emotional tone
- DO separate observable facts from taste interpretation
- DO lower confidence when evidence is sparse
- PREFER compact, information-dense descriptors over generic phrases

OUTPUT: Valid JSON matching this exact schema (no markdown, no extra text):
{
  "source_kind": "editorial|social|design-reference|film-reference|image-board|workspace|archive|product|video|newsletter|portfolio|mixed",
  "content_type": "article|portfolio|post|thread|video|image|pin|landing-page|archive|gallery|note|newsletter|tool|mixed",
  "short_summary": "1 sentence factual description of what the link is",
  "save_reason": "1 sentence inference of why a person with refined taste saved this",
  "appeal_signals": {
    "visual": ["max 4 visual/compositional signals, no platform names"],
    "conceptual": ["max 4 conceptual/intellectual signals"],
    "emotional": ["max 3 emotional/affective signals"],
    "functional": ["max 3 practical/research signals, empty array if none"]
  },
  "style_descriptors": ["3-6 specific aesthetic descriptors, NOT generic keywords"],
  "mood_descriptors": ["2-4 mood/tonal descriptors"],
  "cultural_references": ["0-3 actual cultural anchors only if clearly evidenced"],
  "taste_role": ["1-3 of: identity-signal|visual-inspiration|world-building|research-reference|tonal-reference|creative-trigger|cultural-anchor|mood-capture"],
  "aesthetic_axes": {
    "minimal_vs_dense": 0.0,
    "raw_vs_polished": 0.0,
    "editorial_vs_playful": 0.0,
    "underground_vs_mainstream": 0.0,
    "analog_vs_digital": 0.0,
    "warm_vs_cold": 0.0,
    "decorative_vs_structural": 0.0,
    "utility_vs_atmosphere": 0.0
  },
  "observable_evidence": ["2-4 directly observable facts from the link data"],
  "interpretation": ["2-4 higher-level taste inferences"],
  "confidence": 0.0
}

Aesthetic axes are floats from -1 to +1. 0 = neutral/unclear.
For minimal_vs_dense: -1 = very minimal, +1 = very dense.
Confidence: 0.9 = strong evidence, 0.5 = moderate, 0.2 = sparse/generic page.`;

interface LlmItemResult {
  source_kind: SourceKind;
  content_type: ContentType;
  short_summary: string;
  save_reason: string;
  appeal_signals: AppealSignals;
  style_descriptors: string[];
  mood_descriptors: string[];
  cultural_references: string[];
  taste_role: TasteRole[];
  aesthetic_axes: AestheticAxes;
  observable_evidence: string[];
  interpretation: string[];
  confidence: number;
}

function buildLinkContext(
  input: BuildLinkProfileInput,
  visualProfile?: VisualAnalysisProfile | null
): string {
  const parts: string[] = [];
  parts.push(`URL: ${input.url}`);
  parts.push(`Domain: ${input.domain}`);
  if (input.title) parts.push(`Title: ${input.title}`);
  if (input.siteName) parts.push(`Site name: ${input.siteName}`);
  if (input.description) parts.push(`Meta description: ${input.description.slice(0, 300)}`);
  if (input.extractedText) parts.push(`Page excerpt: ${input.extractedText.slice(0, 1200)}`);
  if (input.userNote) parts.push(`User's personal note: ${input.userNote}`);

  // Rich structured visual analysis — much better than a string description
  if (visualProfile) {
    const v = visualProfile;
    parts.push([
      `VISUAL ANALYSIS:`,
      `  Depicted: ${v.depicted}`,
      `  Image type: ${v.image_type}`,
      `  Composition: ${v.composition}`,
      `  Color: ${v.color_profile.description} (${v.color_profile.dominant_hues.join(", ")}, ${v.color_profile.saturation}, ${v.color_profile.temperature})`,
      v.materiality.length ? `  Materiality: ${v.materiality.join(", ")}` : "",
      `  Stylistic signals: ${v.stylistic_signals.join(", ")}`,
      `  Emotional tone: ${v.emotional_tone.join(", ")}`,
      `  Authorship: ${v.authorship_signal}`,
      `  Visual attraction: ${v.visual_attraction}`,
      `  Visual novelty: ${v.visual_novelty.toFixed(2)}`,
    ].filter(Boolean).join("\n"));
  } else if (input.visionDescription) {
    parts.push(`Visual description: ${input.visionDescription}`);
  }

  return parts.join("\n");
}

async function extractItemWithLlm(
  input: BuildLinkProfileInput,
  client: OpenAI,
  visualProfile?: VisualAnalysisProfile | null
): Promise<LlmItemResult | null> {
  const context = buildLinkContext(input, visualProfile);
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ITEM_EXTRACTION_PROMPT },
        { role: "user", content: context },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as LlmItemResult;
  } catch {
    return null;
  }
}

// ─── Heuristic fallback (no API key) ─────────────────────────────────────────

function inferSourceKind(provider: string, domain: string): SourceKind {
  if (provider === "youtube" || provider === "video") return "video";
  if (provider === "twitter") return "social";
  if (provider === "telegram") return "social";
  if (provider === "instagram") return "image-board";
  if (provider === "pinterest-brand" || domain.includes("pinterest")) return "image-board";
  if (["behance.net", "dribbble.com", "cargo.site", "are.na"].some(d => domain.includes(d))) return "design-reference";
  if (["letterboxd.com", "criterion.com", "mubi.com"].some(d => domain.includes(d))) return "film-reference";
  if (["substack.com", "medium.com"].some(d => domain.includes(d))) return "newsletter";
  return "mixed";
}

function inferContentType(provider: string, previewType: string): ContentType {
  if (provider === "youtube") return "video";
  if (provider === "twitter") return "post";
  if (provider === "telegram") return "post";
  if (provider === "image") return "image";
  if (provider === "instagram") return "pin";
  if (previewType === "oembed") return "post";
  if (provider === "article") return "article";
  return "mixed";
}

const NEUTRAL_AXES: AestheticAxes = {
  minimal_vs_dense: 0,
  raw_vs_polished: 0,
  editorial_vs_playful: 0,
  underground_vs_mainstream: 0,
  analog_vs_digital: 0,
  warm_vs_cold: 0,
  decorative_vs_structural: 0,
  utility_vs_atmosphere: 0,
};

function buildFallbackProfile(input: BuildLinkProfileInput): LlmItemResult {
  const sourceKind = inferSourceKind(input.provider, input.domain);
  const contentType = inferContentType(input.provider, input.previewType);

  const title = input.title ?? "";
  const desc = input.description ?? "";
  const text = input.extractedText ?? "";

  // Build minimal but clean evidence
  const evidence: string[] = [];
  if (title) evidence.push(`Title: "${title}"`);
  if (desc) evidence.push(`Description available: "${desc.slice(0, 120)}"`);
  if (input.visionDescription) evidence.push(`Visual: ${input.visionDescription.slice(0, 200)}`);
  if (input.userNote) evidence.push(`Personal note: "${input.userNote}"`);

  const shortSummary = desc.slice(0, 200) || title || input.domain;
  const saveReason = input.userNote
    ? `User noted: "${input.userNote}"`
    : `Saved from ${input.domain} — signals interest in ${contentType} content from this context.`;

  const hasText = text.length > 400;
  const hasVision = Boolean(input.visionDescription);

  return {
    source_kind: sourceKind,
    content_type: contentType,
    short_summary: shortSummary,
    save_reason: saveReason,
    appeal_signals: {
      visual: hasVision ? [input.visionDescription!.slice(0, 150)] : [],
      conceptual: hasText ? [`textual content from ${input.domain}`] : [],
      emotional: [],
      functional: [],
    },
    style_descriptors: [],
    mood_descriptors: [],
    cultural_references: [],
    taste_role: ["tonal-reference"],
    aesthetic_axes: NEUTRAL_AXES,
    observable_evidence: evidence,
    interpretation: [
      `Limited data available — confidence is low.`,
      input.userNote ? `User's own note provides the strongest signal.` : `No user annotation.`,
    ],
    confidence: hasVision ? 0.35 : hasText ? 0.3 : 0.15,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type BuildLinkProfileInput = {
  normalizedUrl: string;
  url: string;
  canonicalUrl: string | null | undefined;
  title: string | null | undefined;
  description: string | null | undefined;
  domain: string;
  provider: string;
  previewType: string;
  imageUrl: string | null | undefined;
  faviconUrl: string | null | undefined;
  siteName: string | null | undefined;
  author: string | null | undefined;
  publishedAt: Date | null | undefined;
  extractedText: string | null | undefined;
  oEmbedAuthor?: string | null;
  visionDescription?: string | null;           // legacy string fallback
  visualProfile?: VisualAnalysisProfile | null; // rich structured visual analysis
  userNote?: string | null;
};

function buildVectorTextWithVisual(
  r: LlmItemResult,
  visualProfile: VisualAnalysisProfile | null | undefined,
  title: string | null
): string {
  const parts: string[] = [];
  if (title) parts.push(`ITEM: ${title}`);
  parts.push(`WHAT: ${r.short_summary}`);
  parts.push(`WHY SAVED: ${r.save_reason}`);
  if (r.style_descriptors.length) parts.push(`STYLE: ${r.style_descriptors.join(", ")}`);
  if (r.mood_descriptors.length) parts.push(`MOOD: ${r.mood_descriptors.join(", ")}`);
  if (r.appeal_signals.visual.length) parts.push(`VISUAL APPEAL: ${r.appeal_signals.visual.join("; ")}`);
  if (r.appeal_signals.conceptual.length) parts.push(`CONCEPTUAL: ${r.appeal_signals.conceptual.join("; ")}`);
  if (r.appeal_signals.emotional.length) parts.push(`EMOTIONAL: ${r.appeal_signals.emotional.join("; ")}`);
  if (r.cultural_references.length) parts.push(`CULTURAL: ${r.cultural_references.join(", ")}`);
  if (r.interpretation.length) parts.push(`INTERPRETATION: ${r.interpretation.join(" ")}`);
  // Enrich with structured visual signals
  if (visualProfile) {
    if (visualProfile.stylistic_signals.length) parts.push(`VISUAL STYLE: ${visualProfile.stylistic_signals.join(", ")}`);
    if (visualProfile.emotional_tone.length) parts.push(`VISUAL MOOD: ${visualProfile.emotional_tone.join(", ")}`);
    parts.push(`VISUAL ATTRACTION: ${visualProfile.visual_attraction}`);
    if (visualProfile.materiality.length) parts.push(`MATERIALITY: ${visualProfile.materiality.join(", ")}`);
    parts.push(`AUTHORSHIP: ${visualProfile.authorship_signal}`);
  }
  return parts.filter(Boolean).join("\n");
}

export async function buildLinkAiProfileAsync(
  input: BuildLinkProfileInput,
  apiKey?: string | null
): Promise<ItemTasteProfile> {
  let result: LlmItemResult | null = null;

  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (key) {
    const client = new OpenAI({ apiKey: key });
    result = await extractItemWithLlm(input, client, input.visualProfile);
  }

  if (!result) {
    result = buildFallbackProfile(input);
  }

  // Sanitize descriptors
  result.style_descriptors = filterDescriptors(result.style_descriptors);
  result.mood_descriptors = filterDescriptors(result.mood_descriptors);
  result.cultural_references = filterDescriptors(result.cultural_references);
  result.appeal_signals.visual = filterDescriptors(result.appeal_signals.visual);
  result.appeal_signals.conceptual = filterDescriptors(result.appeal_signals.conceptual);
  result.appeal_signals.emotional = filterDescriptors(result.appeal_signals.emotional);
  result.appeal_signals.functional = filterDescriptors(result.appeal_signals.functional);

  const vectorText = buildVectorTextWithVisual(result, input.visualProfile, input.title ?? null);

  return {
    url: input.url,
    domain: input.domain,
    source_kind: result.source_kind,
    content_type: result.content_type,
    title: input.title ?? null,
    language: null,
    short_summary: result.short_summary,
    save_reason: result.save_reason,
    appeal_signals: result.appeal_signals,
    style_descriptors: result.style_descriptors,
    mood_descriptors: result.mood_descriptors,
    cultural_references: result.cultural_references,
    taste_role: result.taste_role,
    aesthetic_axes: result.aesthetic_axes,
    observable_evidence: result.observable_evidence,
    interpretation: result.interpretation,
    confidence: Math.max(0, Math.min(1, result.confidence)),
    visual_analysis: input.visualProfile ?? null,
    vector_ready_text: vectorText,
  };
}

/** Sync fallback — no LLM, used by legacy paths. Prefer buildLinkAiProfileAsync. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildLinkAiProfile(input: BuildLinkProfileInput): ItemTasteProfile {
  const result = buildFallbackProfile(input);
  const vectorText = buildVectorTextWithVisual(result, input.visualProfile, input.title ?? null);
  return {
    url: input.url,
    domain: input.domain,
    source_kind: result.source_kind,
    content_type: result.content_type,
    title: input.title ?? null,
    language: null,
    short_summary: result.short_summary,
    save_reason: result.save_reason,
    appeal_signals: result.appeal_signals,
    style_descriptors: result.style_descriptors,
    mood_descriptors: result.mood_descriptors,
    cultural_references: result.cultural_references,
    taste_role: result.taste_role,
    aesthetic_axes: result.aesthetic_axes,
    observable_evidence: result.observable_evidence,
    interpretation: result.interpretation,
    confidence: result.confidence,
    visual_analysis: input.visualProfile ?? null,
    vector_ready_text: vectorText,
  };
}
