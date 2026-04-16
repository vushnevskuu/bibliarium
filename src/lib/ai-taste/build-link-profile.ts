import type { Link } from "@prisma/client";
import { STOPWORDS } from "./stopwords";
import type { AiLinkProfile } from "./types";

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []).filter(
    (w) => !STOPWORDS.has(w)
  );
}

function topTokens(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const t of tokenize(text)) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

function guessEntities(title: string | null): string[] {
  if (!title) return [];
  const matches = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g);
  return matches ? Array.from(new Set(matches)).slice(0, 12) : [];
}

function moodFromSignals(input: {
  provider: string;
  previewType: string;
  hasImage: boolean;
  textLen: number;
}): string[] {
  const m: string[] = [];
  if (input.provider === "youtube") m.push("audiovisual", "long-form-capable");
  if (input.provider === "twitter") m.push("social", "short-form");
  if (input.provider === "telegram") m.push("social", "channel-post");
  if (input.provider === "image") m.push("visual-first");
  if (input.hasImage) m.push("image-forward");
  if (input.textLen > 4000) m.push("text-heavy", "informative");
  else if (input.textLen > 800) m.push("moderate-read");
  else m.push("snippet-led");
  if (input.previewType === "embed") m.push("native-embed");
  return Array.from(new Set(m));
}

function aestheticsFromProvider(provider: string, previewType: string): string[] {
  const a: string[] = [];
  if (provider === "image") a.push("photographic", "static-visual");
  if (provider === "youtube") a.push("video-ui", "thumbnail-led");
  if (provider === "twitter") a.push("social-card", "conversation");
  if (provider === "telegram") a.push("social-card", "messaging-ui");
  if (provider === "article") a.push("editorial", "reading");
  if (provider === "web") a.push("web-landing", "mixed-layout");
  if (previewType === "oembed") a.push("rich-embed");
  if (previewType === "og") a.push("open-graph-card");
  return Array.from(new Set(a));
}

function guessLanguage(): string {
  return "en"; // MVP: assume English; swap for franc/langdetect later
}

export type BuildLinkProfileInput = Pick<
  Link,
  | "normalizedUrl"
  | "url"
  | "canonicalUrl"
  | "title"
  | "description"
  | "domain"
  | "provider"
  | "previewType"
  | "imageUrl"
  | "faviconUrl"
  | "siteName"
  | "author"
  | "publishedAt"
  | "extractedText"
> & {
  oEmbedAuthor?: string | null;
  visionDescription?: string | null;
  userNote?: string | null;
};

export function buildLinkAiProfile(row: BuildLinkProfileInput): AiLinkProfile {
  const desc = row.description ?? "";
  const title = row.title ?? "";
  const excerptSource = [
    title,
    desc,
    row.extractedText ?? "",
    row.siteName ?? "",
  ].join(" \n ");
  const excerpt = (row.extractedText ?? desc).replace(/\s+/g, " ").trim();
  const excerptShort = excerpt.slice(0, 900);
  const summary =
    desc.slice(0, 400) ||
    excerptShort.slice(0, 400) ||
    `${row.provider} from ${row.domain}`;

  const topics = topTokens(excerptSource, 10);
  const tags = topTokens(`${title} ${row.domain.replace(/\./g, " ")}`, 8);
  const entities = guessEntities(row.title);
  const textLen = (row.extractedText ?? "").length;
  const mood_tone = moodFromSignals({
    provider: row.provider,
    previewType: row.previewType,
    hasImage: Boolean(row.imageUrl),
    textLen,
  });
  const aesthetic_style = aestheticsFromProvider(row.provider, row.previewType);

  const author =
    row.author ||
    row.oEmbedAuthor ||
    row.siteName ||
    null;

  const vector_ready_text = [
    `TITLE: ${title}`,
    `DOMAIN: ${row.domain}`,
    `TYPE: ${row.provider}/${row.previewType}`,
    `SUMMARY: ${summary}`,
    topics.length ? `TOPICS: ${topics.join(", ")}` : "",
    row.visionDescription ? `VISUAL: ${row.visionDescription}` : "",
    row.userNote ? `USER_NOTE: ${row.userNote}` : "",
    excerptShort ? `BODY_EXCERPT: ${excerptShort}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    schema_version: 1,
    normalized_url: row.normalizedUrl,
    canonical_url: row.canonicalUrl ?? null,
    content_type: `${row.provider}:${row.previewType}`,
    title: row.title,
    summary,
    description: row.description,
    domain: row.domain,
    favicon_url: row.faviconUrl,
    author_publisher: author,
    publish_date: row.publishedAt
      ? row.publishedAt.toISOString().slice(0, 10)
      : null,
    main_image: row.imageUrl,
    extracted_text_excerpt: excerptShort,
    topics,
    tags,
    entities,
    mood_tone,
    aesthetic_style,
    format_classification: row.previewType,
    language_guess: guessLanguage(),
    safety_fetch_status: excerpt ? "ok" : "partial",
    vision_description: row.visionDescription ?? null,
    user_note: row.userNote ?? null,
    vector_ready_text,
  };
}
