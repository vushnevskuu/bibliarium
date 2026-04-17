/**
 * Taste Dossier v4 — machine-readable latent preference graph.
 *
 * Architecture:
 *   saved_items          — per-item classification, visual layer, semantic layer, taste interpretation
 *   visual_profile       — aggregated from items with visual_taste_relevance >= 0.4
 *   cultural_profile     — aggregated from items with cultural_taste_relevance >= 0.4
 *   utility_profile      — aggregated from items with utility_relevance >= 0.4
 *   save_behavior_profile — meta-profile: how the user saves, not what
 *   taste_psychology     — non-clinical hypotheses, conservative and evidence-backed
 *   master_summary       — top-level synthesis for LLM conditioning
 *
 * Critical rule: utilitarian links MUST NOT contaminate the visual taste profile.
 * Every item is classified by save_intent + relevance before aggregation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ITEM-LEVEL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ItemKind =
  | "visual_reference"
  | "cultural_reference"
  | "tool"
  | "article"
  | "tutorial"
  | "product"
  | "social_post"
  | "video"
  | "mixed";

export type SaveIntent =
  | "visual_inspiration"
  | "mood_capture"
  | "identity_signal"
  | "cultural_signal"
  | "read_later"
  | "practical_reference"
  | "tool_for_future_use"
  | "workflow_resource"
  | "research";

export type SaveIntentBlock = {
  primary: SaveIntent;
  secondary: SaveIntent[];
  confidence: number;
};

export type RelevanceScores = {
  taste_relevance: number;
  visual_taste_relevance: number;
  cultural_taste_relevance: number;
  utility_relevance: number;
  workflow_relevance: number;
  identity_signal_relevance: number;
};

export type ProfileRouting = {
  affects_visual_profile: boolean;
  affects_cultural_profile: boolean;
  affects_utility_profile: boolean;
  affects_workflow_profile: boolean;
  affects_persona_profile: boolean;
};

// ─── Visual layer ─────────────────────────────────────────────────────────────

export type ImageType =
  | "object_photo" | "photograph" | "illustration" | "screenshot"
  | "graphic_design" | "collage" | "product_photo" | "poster"
  | "ui_screenshot" | "video_thumbnail" | "pin_board" | "text_image"
  | "abstract" | "mixed" | "unknown";

export type PolishLevel = "raw" | "lo-fi" | "mixed" | "refined" | "highly-polished";

export type VisualLayer = {
  present: boolean;
  importance: number;                    // 0–1: how central is the visual to this save
  depicted_subject: string[];            // factual: what is shown
  image_type: ImageType;
  composition: string[];                 // e.g. ["object-centric", "centered subject"]
  color_tone: string[];                  // e.g. ["muted", "warm-neutral"]
  texture_materiality: string[];         // e.g. ["metal", "rough", "assembled"]
  polish_level: PolishLevel;
  visual_authorship: number;             // 0–1: how authored/intentional vs. generic
  visual_oddity: number;                 // 0–1: how unusual/non-mainstream
  stylistic_signals: string[];           // vocabulary: found-object, editorial, lo-fi, etc.
  cultural_signal: string[];             // cultural anchors if visible
  emotional_tone: string[];              // e.g. ["dry", "curious", "slightly strange"]
  confidence: number;
};

// ─── Semantic layer ───────────────────────────────────────────────────────────

export type SemanticLayer = {
  short_summary: string;
  topic_tags: string[];
  use_case: string;                      // e.g. "inspiration", "reference", "learning"
  confidence: number;
};

// ─── Taste interpretation ─────────────────────────────────────────────────────

export type TasteInterpretation = {
  should_affect_aesthetic_profile: boolean;
  should_affect_cultural_profile: boolean;
  weight_in_aesthetic_aggregation: number; // 0–1
  weight_in_cultural_aggregation: number;
  weight_in_utility_aggregation: number;
  aesthetic_contamination_risk: number;    // 0–1
  save_reason: string;
  observable_evidence: string[];
  interpretation: string[];
  confidence: number;
};

// ─── Full item ────────────────────────────────────────────────────────────────

export type SavedItemV4 = {
  item_index: number;
  url: string;
  domain: string;
  canonical_url: string | null;
  title: string | null;

  item_kind: ItemKind;
  content_format: string;                // content_type shorthand
  source_kind: string;

  save_intent: SaveIntentBlock;
  relevance: RelevanceScores;
  profile_routing: ProfileRouting;

  visual_layer: VisualLayer;
  semantic_layer: SemanticLayer;
  taste_interpretation: TasteInterpretation;

  vector_ready_text: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE-LEVEL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EvidencedSignal = {
  label: string;
  strength: number;
  confidence: number;
  coverage_count: number;
  evidence_item_indices: number[];
};

// ─── Visual profile ───────────────────────────────────────────────────────────

export type VisualPreferenceAxes = {
  clean_vs_textured: number;
  polished_vs_raw: number;
  commercial_vs_authored: number;
  literal_vs_symbolic: number;
  mainstream_vs_subcultural: number;
  decorative_vs_structural: number;
};

export type VisualProfile = {
  summary_short: string;
  recurring_visual_signals: EvidencedSignal[];
  visual_preference_axes: VisualPreferenceAxes;
  repeated_moods: string[];
  likely_visual_likes_more_of: string[];
  confidence: number;
  vector_ready_text: string;
};

// ─── Cultural profile ─────────────────────────────────────────────────────────

export type CulturalProfile = {
  summary_short: string;
  core_attraction: string[];
  recurring_patterns: EvidencedSignal[];
  cultural_gravity: string[];
  likely_likes_more_of: string[];
  likely_dislikes: string[];
  confidence: number;
  vector_ready_text: string;
};

// ─── Utility profile ──────────────────────────────────────────────────────────

export type UtilityProfile = {
  summary_short: string;
  tooling_interests: EvidencedSignal[];
  workflow_preferences: string[];
  should_not_contaminate_visual_profile: true;
  confidence: number;
  vector_ready_text: string;
};

// ─── Save behavior profile ────────────────────────────────────────────────────

export type SelectionStyle = {
  collects_for_visual_reference: number;
  collects_for_cultural_signal: number;
  collects_for_future_use: number;
  collects_for_identity_expression: number;
  collects_for_practical_implementation: number;
  collects_rare_over_popular: number;
  collects_authored_over_generic: number;
};

export type SaveBehaviorProfile = {
  summary_short: string;
  selection_style: SelectionStyle;
  save_intent_distribution: { intent: SaveIntent; count: number }[];
  behavioral_notes: string[];
  confidence: number;
};

// ─── Taste psychology ─────────────────────────────────────────────────────────

export type TraitHypothesis = {
  trait: string;
  label: string;
  estimated_level: number;            // 0–1 (not a category — a scalar)
  confidence: number;
  evidence: string[];
  coverage_item_indices: number[];
};

export type PersonaBlendEntry = {
  persona: string;
  weight: number;
  description: string;
};

export type TastePsychologyV4 = {
  guardrails: {
    non_clinical: true;
    non_diagnostic: true;
    inference_only_from_saved_links: true;
    explicitly_uncertain: true;
  };
  trait_hypotheses: TraitHypothesis[];
  persona_blend: PersonaBlendEntry[];
  confidence: number;
  vector_ready_text: string;
};

// ─── Master summary ───────────────────────────────────────────────────────────

export type MasterSummary = {
  profile_summary_short: string;
  profile_summary_rich: string;
  confidence: number;
  vector_ready_text: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// TOP-LEVEL DOSSIER v4
// ─────────────────────────────────────────────────────────────────────────────

export type TasteDossierV4 = {
  profile_id: string;
  profile_version: "taste_dossier_v4";
  generated_at: string;
  stats: {
    item_count: number;
    domain_count: number;
    language_mix: string[];
    source_mix: { source: string; count: number }[];
  };
  saved_items: SavedItemV4[];
  visual_profile: VisualProfile | null;
  cultural_profile: CulturalProfile | null;
  utility_profile: UtilityProfile | null;
  save_behavior_profile: SaveBehaviorProfile;
  taste_psychology: TastePsychologyV4 | null;
  master_summary: MasterSummary;
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY COMPAT — kept so export-payload.ts compiles during migration
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated — use SavedItemV4 */
export type ItemTasteProfile = SavedItemV4 & {
  // v3 compat shims
  normalized_url?: string;
  short_summary?: string;
  save_reason?: string;
  appeal_signals?: { visual: string[]; conceptual: string[]; emotional: string[]; functional: string[] };
  style_descriptors?: string[];
  mood_descriptors?: string[];
  cultural_references?: string[];
  taste_role?: string[];
  aesthetic_axes?: Record<string, number>;
  observable_evidence?: string[];
  interpretation?: string[];
  confidence?: number;
  visual_analysis?: unknown;
  classification?: unknown;
  language?: string | null;
  source_kind?: string;
  content_type?: string;
};

/** @deprecated — use TasteDossierV4 */
export type TasteDossierV2 = TasteDossierV4;

/** @deprecated */
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
  saved_items: ItemTasteProfile[];
  // v4 extras
  visual_profile?: VisualProfile | null;
  cultural_profile?: CulturalProfile | null;
  utility_profile?: UtilityProfile | null;
  save_behavior_profile?: SaveBehaviorProfile;
  taste_psychology?: TastePsychologyV4 | null;
  master_summary?: MasterSummary;
  taste_summary?: unknown;
  visual_taste_summary?: unknown;
};

// Re-export old names that other files may reference
export type { VisualPreferenceAxes as VisualPreferenceAxesOld };
export type TastePsychology = TastePsychologyV4;
export type VisualTasteSummary = VisualProfile;
export type TasteProfileSummary = { profile_summary_short: string; profile_summary_rich: string; confidence: number };
export type EvidencedClaim = EvidencedSignal;
export type ProfileAestheticAxes = VisualPreferenceAxes;
export type ItemClassification = {
  item_kind: ItemKind;
  save_intent: SaveIntentBlock;
  relevance_scores: RelevanceScores;
  routing_flags: ProfileRouting;
  aggregation_weights: {
    should_affect_aesthetic_profile: boolean;
    should_affect_cultural_profile: boolean;
    weight_in_aesthetic_aggregation: number;
    weight_in_cultural_aggregation: number;
    weight_in_utility_aggregation: number;
  };
  aesthetic_contamination_risk: number;
};
