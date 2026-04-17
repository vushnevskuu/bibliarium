/**
 * Vision analysis and transcript summarization via OpenAI.
 * These run at link-save time and feed into the taste pipeline.
 */

import OpenAI from "openai";

function getClient(userApiKey?: string | null): OpenAI | null {
  const key = userApiKey || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

const VISION_PROMPT = `Describe this image in 2-4 sentences focused on:
1. What is depicted (objects, scenes, environments)
2. Visual aesthetic and style (e.g. minimalist, maximalist, brutalist, organic, editorial)
3. Color palette and lighting mood
4. If it is design/UI: layout philosophy, typography, interaction patterns

Be specific and vocabulary-rich. Focus on aesthetic signals useful for understanding the saver's taste.
Do not mention the platform it came from.`;

export async function analyzeImageForTaste(
  imageUrl: string,
  userApiKey?: string | null
): Promise<string | null> {
  const client = getClient(userApiKey);
  if (!client) return null;
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

const TRANSCRIPT_PROMPT = `Summarize this video transcript in 2-3 sentences for a taste profile.
Focus on: main topic, tone and style of the creator, key ideas, and what kind of audience sensibility it addresses.
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

// generateTasteSummary removed — LLM aggregation now lives in build-master-profile.ts
