/**
 * Vision analysis of images via OpenAI GPT-4o-mini.
 * Returns a rich description for the AI taste profile.
 * Gracefully returns null if OPENAI_API_KEY is not set or the call fails.
 */

import OpenAI from "openai";

function getClient(userApiKey?: string | null): OpenAI | null {
  const key = userApiKey || process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

const VISION_PROMPT = `You are analyzing an image saved to a personal taste board.
Describe in 3-5 sentences:
1. What is depicted (objects, people, scenes, places)
2. Visual aesthetic and style (minimalist, maximalist, brutalist, organic, editorial, etc.)
3. Color palette and mood (warm/cool, dark/light, calm/energetic, saturated/muted)
4. If design/UI: layout philosophy, typography feel, interaction style
5. Cultural or contextual references if recognizable

Be specific and vocabulary-rich. Focus on aesthetic signals useful for understanding taste.`;

export async function analyzeImageForTaste(
  imageUrl: string,
  userApiKey?: string | null
): Promise<string | null> {
  const client = getClient(userApiKey);
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" }, // "low" = cheaper, still great for aesthetics
            },
          ],
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

const TRANSCRIPT_SUMMARY_PROMPT = `Summarize this video transcript in 3-4 sentences for a taste profile.
Focus on: main topic, tone/style of the creator, key ideas, target audience vibe.
Be concise and vocabulary-rich.

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
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `${TRANSCRIPT_SUMMARY_PROMPT}\n\n${transcript.slice(0, 6000)}`,
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

const MASTER_PROFILE_PROMPT = `Based on these saved items from someone's taste board, write a 2-3 sentence taste profile.
Be insightful, specific, and use rich vocabulary. Focus on aesthetic patterns, creative interests, and sensibilities.
Avoid generic phrases like "diverse interests" — be precise about what makes this taste distinctive.

Items:\n`;

export async function generateTasteSummary(
  items: { title: string | null; description: string | null; visionDescription: string | null; note: string | null }[],
  userApiKey?: string | null
): Promise<string | null> {
  const client = getClient(userApiKey);
  if (!client) return null;

  const itemLines = items
    .slice(0, 30)
    .map((item, i) => {
      const parts = [
        item.title ? `"${item.title}"` : null,
        item.visionDescription,
        item.note ? `Note: "${item.note}"` : null,
      ].filter(Boolean);
      return `${i + 1}. ${parts.join(" — ")}`;
    })
    .join("\n");

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        { role: "user", content: `${MASTER_PROFILE_PROMPT}${itemLines}` },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
