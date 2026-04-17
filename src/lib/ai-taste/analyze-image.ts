/**
 * Visual analysis via OpenAI Vision + transcript summarization.
 *
 * analyzeImageStructured — returns VisualAnalysisProfile (structured JSON)
 * summarizeTranscript — returns plain string summary for YouTube
 */

import OpenAI from "openai";

// Raw visual analysis result — mirrors the shape expected by build-link-profile.ts
export type RawVisualAnalysis = {
  image_type?: string;
  composition?: string;
  color_profile?: { saturation?: string; temperature?: string; dominant_hues?: string[]; description?: string };
  materiality?: string[];
  stylistic_signals?: string[];
  emotional_tone?: string[];
  authorship_signal?: string;
  visual_novelty?: number;
  depicted?: string;
  visual_attraction?: string;
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

const VISUAL_EXTRACTION_PROMPT = `You are analyzing an image saved to a personal taste board.
Your job is NOT to label objects. Your job is to extract the aesthetic and visual language of the image
as a structured taste signal.

RULES:
- Prioritize aesthetic properties over object labels
- Use specific vocabulary: found-object, editorial, internet-native, lo-fi, subcultural,
  art-house, industrial, graphic, tactile, archive-like, authored, non-template,
  institutional, brutalist, organic, decorative, maximalist, minimal, vernacular,
  aspirational, anti-aesthetic, cinematic, printed-matter, collaged, referential, pop, flat
- Be specific about color — not just "warm" but "muted amber and bone white with deep shadow"
- Distinguish composition carefully — "centered subject on empty ground" differs from "layered collage"
- authorship_signal must be honest — most images are NOT "strongly authored"
- visual_novelty: 0.0 = completely generic, 1.0 = highly unusual. Be conservative.
- confidence: how confident you are in this analysis. 0.3 for unclear images.

OUTPUT: valid JSON only, no markdown:
{
  "image_type": "photograph|illustration|screenshot|graphic-design|collage|product-photo|poster|ui-screenshot|video-thumbnail|pin-board|text-image|abstract|mixed|unknown",
  "composition": "1 sentence describing spatial structure",
  "color_profile": {
    "dominant_hues": ["2-4 specific hue descriptions"],
    "saturation": "desaturated|muted|moderate|saturated|hyper-saturated",
    "brightness": "dark|dim|balanced|bright|high-key",
    "temperature": "warm|neutral|cool|mixed",
    "description": "1 sentence on color mood"
  },
  "materiality": ["0-4 physical/tactile qualities suggested by the image"],
  "stylistic_signals": ["3-6 aesthetic vocabulary terms from the list above"],
  "emotional_tone": ["2-3 mood descriptors"],
  "authorship_signal": "strongly authored|authored|neutral|template-like|algorithmic",
  "visual_novelty": 0.0,
  "depicted": "1 sentence: what is shown",
  "visual_attraction": "1 sentence: what aesthetic quality might attract a person with taste",
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
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISUAL_EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
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
  // Flatten to string for legacy text-based pipeline
  return [
    result.depicted,
    result.visual_attraction,
    result.stylistic_signals?.join(", "),
    result.emotional_tone?.join(", "),
    result.color_profile?.description,
  ].filter(Boolean).join(". ");
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTube transcript summarization
// ─────────────────────────────────────────────────────────────────────────────

const TRANSCRIPT_PROMPT = `Summarize this video transcript in 2-3 sentences for a taste profile.
Focus on: main topic, tone and style of the creator, key ideas, what kind of audience sensibility it addresses.
Be specific, avoid generic phrases.

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
