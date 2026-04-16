/**
 * AI-readable link profile (stored as JSON string in DB).
 * Designed for LLM ingestion without re-crawling raw URLs.
 */
export type AiLinkProfile = {
  schema_version: 1;
  normalized_url: string;
  canonical_url: string | null;
  content_type: string;
  title: string | null;
  summary: string;
  description: string | null;
  domain: string;
  favicon_url: string | null;
  author_publisher: string | null;
  publish_date: string | null;
  main_image: string | null;
  extracted_text_excerpt: string;
  topics: string[];
  tags: string[];
  entities: string[];
  mood_tone: string[];
  aesthetic_style: string[];
  format_classification: string;
  language_guess: string;
  safety_fetch_status: "ok" | "partial" | "blocked" | "unknown";
  vision_description: string | null;
  user_note: string | null;
  vector_ready_text: string;
};

export type AiMasterProfile = {
  schema_version: 1;
  user_slug: string;
  generated_at: string;
  taste_summary_paragraph: string;
  top_themes: { label: string; weight: number }[];
  top_aesthetics: { label: string; weight: number }[];
  content_type_breakdown: Record<string, number>;
  clusters: { id: string; label: string; link_ids: string[] }[];
  representative_link_ids: string[];
  aggregate_stats: {
    total_items: number;
    unique_domains: number;
    providers: Record<string, number>;
  };
  semantic_overview: string;
  saved_items: AiLinkProfile[];
};
