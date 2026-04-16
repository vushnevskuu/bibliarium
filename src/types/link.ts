export type LinkProvider =
  | "youtube"
  | "twitter"
  | "telegram"
  | "instagram"
  | "pinterest-brand"
  | "image"
  | "article"
  | "web";

export type PreviewType = "embed" | "oembed" | "og" | "image" | "fallback";

import type { AiLinkProfile } from "@/lib/ai-taste/types";

/** Safe to pass from RSC to client components */
export type LinkSerialized = {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  siteName: string | null;
  domain: string;
  provider: string;
  previewType: string;
  embedHtml: string | null;
  embedUrl: string | null;
  oEmbedJson: Record<string, unknown> | null;
  note: string | null;
  collectionId: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  /** Structured AI-readable profile when ingestion has run */
  aiProfile: AiLinkProfile | null;
};

export type CollectionWithCount = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { links: number };
};
