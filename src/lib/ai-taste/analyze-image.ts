/**
 * Visual analysis via OpenAI Vision + transcript summarization.
 *
 * analyzeImageStructured — returns VisualAnalysisProfile (structured JSON)
 * summarizeTranscript — returns plain string summary for YouTube
 */

import OpenAI from "openai";

// Raw visual analysis — consumed by build-link-profile.ts
export type RawVisualAnalysis = {
  image_type?: string;
  composition?: string;
  color_profile?: {
    saturation?: string;
    temperature?: string;
    dominant_hues?: string[];
    description?: string;
    brightness?: string;
  };
  materiality?: string[];
  stylistic_signals?: string[];
  emotional_tone?: string[];
  authorship_signal?: string;
  visual_novelty?: number;
  /** Observable subject — do not treat as the reason for saving */
  depicted?: string;
  /** Visual/graphic reason someone might keep this (linework, palette, attitude) — NOT meme/joke logic */
  visual_attraction?: string;
  /** Linework, contour energy, vector vs brush, grain, halftone, digital roughness */
  execution_read?: string;
  /** One short phrase: odd or uncanny but compositionally controlled (if applicable) */
  controlled_weirdness?: string;
  /** Explicit: if subject looks meme-like, state non-meme visual reasons first */
  non_subject_attraction?: string;
  confidence?: number;
};

function getClient(userApiKey?: string | null): OpenAI | null {
  const key = userApiKey || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured visual extraction
// ─────────────────────────────────────────────────────────────────────────────

const VISION_SYSTEM = `Optimize for correctness and taste discrimination (clustering/embeddings), not for sounding insightful.
Prefer checkable visual facts over literary prose. If uncertain, use shorter strings and lower confidence — do not invent detail.`;

const VISUAL_EXTRACTION_PROMPT = `Extract structured visual variables from this board image. Output is for machine comparison across saves, not for a human essay.

THREE LAYERS (keep separate; do not merge into one story):
1) depicted — plain factual content only (odd subjects allowed; no motive)
2) execution_read — measurable graphic construction: line quality, edge sharpness, fill vs stroke, vector vs raster cues, grain/halftone, collage seams, crop/aspect, figure-ground
3) visual_attraction + non_subject_attraction — only layout/color/rendering reasons someone might tag this as reference material (no punchline logic, no "vibes" without a visual anchor)

DISCRIMINATION:
- stylistic_signals: 4–7 short tokens (2–4 words each max) that would help **distinguish** this image from a generic pin or stock frame in the same broad category. Drop a token if it is only decorative wording.
- Do NOT use: compelling, powerful, resonates, speaks to, journey, narrative arc, soulful, iconic, curated, essence, profound.
- emotional_tone: 2–4 low-drama adjectives tied to **look** (e.g. "flat", "noisy", "clinical", "warm-muted"), not character judgments.

VOCAB (use only when visually justified; mix with literal observations):
authored, hand-made, raw-graphic, weird-but-controlled, low-polish, DIY, internet-native, subcultural, indie,
vernacular-web, anti-template, editorial, industrial, tactile, archive-like, lo-fi, halftone-grain,
poster-like, object-photo, ui-screenshot, flat-color-blocks, high-contrast, low-information-density

CALIBRATION:
- authorship_signal: strongly authored | authored | neutral | template-like | algorithmic
  → Do NOT choose "neutral" when the frame is clearly hand-drawn, poster/graphic, collage, zine-like, or non-template illustration — use authored or strongly authored instead.
  → Reserve "template-like" / "algorithmic" for stock UI, generic marketing grids, obvious stock photo tropes.
- visual_novelty: by graphic/layout rarity, not by "weird subject"
- confidence: image legibility and how sure you are of each layer; thumbnails default ~0.35–0.5

OUTPUT valid JSON only, no markdown:
{
  "image_type": "photograph|illustration|screenshot|graphic-design|collage|product-photo|poster|ui-screenshot|video-thumbnail|pin-board|text-image|abstract|mixed|unknown",
  "composition": "1 sentence: spatial structure, cropping, layering, negative space",
  "color_profile": {
    "dominant_hues": ["2–4 specific hue phrases"],
    "saturation": "desaturated|muted|moderate|saturated|hyper-saturated",
    "brightness": "dark|dim|balanced|bright|high-key",
    "temperature": "warm|neutral|cool|mixed",
    "description": "1 sentence on color mood"
  },
  "materiality": ["0–4 tactile/digital material reads"],
  "stylistic_signals": ["4–7 aesthetic tokens"],
  "emotional_tone": ["2–4 mood descriptors tied to visuals"],
  "authorship_signal": "neutral",
  "visual_novelty": 0.0,
  "depicted": "1 factual sentence",
  "execution_read": "1 sentence on linework/rendering/texture/graphic construction",
  "controlled_weirdness": "short phrase or empty string if not applicable",
  "non_subject_attraction": "1 sentence: visual reasons to save that are NOT the subject punchline",
  "visual_attraction": "1 sentence merging execution + palette + attitude",
  "confidence": 0.0
}`;

export async function analyzeImageStructured(
  imageUrl: string,
  userApiKey?: string | null
): Promise<RawVisualAnalysis | null> {
  const client = getClient(userApiKey);
  if (!client) return null;
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      temperature: 0.08,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VISION_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: VISUAL_EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as RawVisualAnalysis;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy string-based vision (kept for backward compat in save-captured-link)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeImageForTaste(
  imageUrl: string,
  userApiKey?: string | null
): Promise<string | null> {
  const result = await analyzeImageStructured(imageUrl, userApiKey);
  if (!result) return null;
  return [
    result.depicted,
    result.execution_read,
    result.non_subject_attraction,
    result.visual_attraction,
    result.stylistic_signals?.join(", "),
    result.emotional_tone?.join(", "),
    result.color_profile?.description,
  ].filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTube transcript summarization
// ─────────────────────────────────────────────────────────────────────────────

const TRANSCRIPT_PROMPT = `Compress this transcript into 2-3 neutral sentences for taste routing (topic + delivery + structure).
Optimize for factual discrimination (what kind of video this is), not for sounding insightful. No praise, no "resonates", no audience psychoanalysis unless stated verbatim.

Transcript:`;

export async function summarizeTranscript(
  transcript: string,
  userApiKey?: string | null
): Promise<string | null> {
  const client = getClient(userApiKey);
  if (!client) return null;
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 180,
      messages: [
        { role: "user", content: `${TRANSCRIPT_PROMPT}\n\n${transcript.slice(0, 6000)}` },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
