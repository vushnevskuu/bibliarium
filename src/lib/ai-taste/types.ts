/**
 * Taste Dossier v2 — machine-readable latent preference graph.
 * Optimized for downstream LLM conditioning, NOT for human display.
 *
 * Key design principles:
 * - Separates raw facts (Layer 1) from taste inference (Layer 2) from profile (Layer 3)
 * - Aesthetic axes use [-1, 1] floats so they can be aggregated and compared
 * - confidence scores let a downstream model weight signals appropriately
 * - platform/source names never appear as taste descriptors
 */

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — RAW FACTS (observable, low-inference)
// ─────────────────────────────────────────────────────────────────────────────

export type SourceKind =
  | "editorial"
  | "social"
  | "design-reference"
  | "film-reference"
  | "image-board"
  | "workspace"
  | "archive"
  | "product"
  | "video"
  | "newsletter"
  | "portfolio"
  | "mixed";

export type ContentType =
  | "article"
  | "portfolio"
  | "post"
  | "thread"
  | "video"
  | "image"
  | "pin"
  | "landing-page"
  | "archive"
  | "gallery"
  | "note"
  | "newsletter"
  | "tool"
  | "mixed";

export type TasteRole =
  | "identity-signal"
  | "visual-inspiration"
  | "world-building"
  | "research-reference"
  | "tonal-reference"
  | "creative-trigger"
  | "cultural-anchor"
  | "mood-capture";

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL ANALYSIS — per-item structured image profile
// ─────────────────────────────────────────────────────────────────────────────

export type ImageType =
  | "photograph"
  | "illustration"
  | "screenshot"
  | "graphic-design"
  | "collage"
  | "product-photo"
  | "poster"
  | "ui-screenshot"
  | "video-thumbnail"
  | "pin-board"
  | "text-image"
  | "abstract"
  | "mixed"
  | "unknown";

export type VisualAnalysisProfile = {
  image_type: ImageType;

  /** Compositional structure: e.g. "centered subject on clean background", "grid-based layout" */
  composition: string;

  /** Dominant palette and lighting quality */
  color_profile: {
    dominant_hues: string[];    // e.g. ["muted earth tones", "off-white", "deep navy"]
    saturation: "desaturated" | "muted" | "moderate" | "saturated" | "hyper-saturated";
    brightness: "dark" | "dim" | "balanced" | "bright" | "high-key";
    temperature: "warm" | "neutral" | "cool" | "mixed";
    description: string;        // 1 sentence
  };

  /** Physical or tactile quality suggested by the image */
  materiality: string[];        // e.g. ["concrete", "worn paper", "soft cotton", "raw metal"]

  /**
   * Aesthetic/stylistic signals — the key taste vocabulary.
   * Use specific terms from this vocabulary when applicable:
   * found-object | editorial | internet-native | lo-fi | subcultural |
   * art-house | industrial | graphic | tactile | archive-like | authored |
   * non-template | institutional | brutalist | organic | decorative |
   * maximalist | minimal | vernacular | aspirational | anti-aesthetic |
   * cinematic | printed-matter | collaged | referential | pop | flat
   */
  stylistic_signals: string[];

  /** Mood/emotional atmosphere conveyed by the image */
  emotional_tone: string[];     // e.g. ["quiet melancholy", "sharp clarity", "warm nostalgia"]

  /**
   * Whether the image feels authored/intentional vs. generic/template:
   * "strongly authored" | "authored" | "neutral" | "template-like" | "algorithmic"
   */
  authorship_signal: string;

  /**
   * How surprising/non-generic this image feels in context of mainstream saves:
   * 0.0 = completely generic, 1.0 = highly distinctive/unusual
   */
  visual_novelty: number;

  /** What is depicted — factual layer */
  depicted: string;             // 1 sentence: what you see

  /** Why this visual might attract the saver — inferred aesthetic pull */
  visual_attraction: string;    // 1 sentence: what aesthetic quality draws attention

  confidence: number;           // 0.0–1.0
};

// Profile-level visual taste aggregation
export type VisualPreferenceAxes = {
  raw_vs_refined: number;       // -1 raw/unpolished ↔ +1 highly refined
  sparse_vs_dense: number;      // -1 minimal/sparse ↔ +1 dense/layered
  warm_vs_cool: number;         // -1 warm ↔ +1 cool
  analog_vs_digital: number;    // -1 film/print/analog ↔ +1 screen-native/digital
  authored_vs_generic: number;  // -1 template/generic ↔ +1 strongly authored
  dark_vs_bright: number;       // -1 dark/moody ↔ +1 bright/clean
};

export type VisualTasteCluster = {
  label: string;
  description: string;
  stylistic_signals: string[];
  evidence_item_indices: number[];
  strength: number;             // 0.0–1.0
};

export type VisualTasteSummary = {
  /** Most recurrent stylistic signals across high-confidence visual items */
  recurring_visual_signals: { signal: string; count: number; item_indices: number[] }[];
  visual_preference_axes: VisualPreferenceAxes;
  repeated_moods: string[];
  dominant_color_tendencies: string[];
  authorship_tendency: string;  // e.g. "strong preference for authored/non-template visuals"
  visual_taste_clusters: VisualTasteCluster[];
  /** Items with no/low-quality visuals — excluded from visual analysis */
  visual_coverage: number;      // fraction of items that had analyzable images
  confidence: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — ITEM-LEVEL TASTE INTERPRETATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aesthetic axes on a [-1, 1] float scale.
 * 0 = neutral / unclear.
 * Named as "A_vs_B": -1 means strongly A, +1 means strongly B.
 */
export type AestheticAxes = {
  minimal_vs_dense: number;       // -1 minimal/sparse ↔ +1 dense/maximal
  raw_vs_polished: number;        // -1 raw/rough ↔ +1 refined/polished
  editorial_vs_playful: number;   // -1 serious/editorial ↔ +1 playful/experimental
  underground_vs_mainstream: number; // -1 niche/underground ↔ +1 mainstream/popular
  analog_vs_digital: number;      // -1 analog/physical ↔ +1 digital/screen-native
  warm_vs_cold: number;           // -1 warm/organic ↔ +1 cold/clinical
  decorative_vs_structural: number; // -1 ornamental ↔ +1 functional/structural
  utility_vs_atmosphere: number;  // -1 utility-first ↔ +1 atmosphere/mood-first
};

export type AppealSignals = {
  visual: string[];       // visual / compositional / material appeal
  conceptual: string[];   // intellectual / conceptual / thematic appeal
  emotional: string[];    // emotional / affective draw
  functional: string[];   // practical / research / tool value
};

export type ItemTasteProfile = {
  // Raw facts (Layer 1)
  url: string;
  domain: string;
  source_kind: SourceKind;
  content_type: ContentType;
  title: string | null;
  language: string | null;

  // Inferred interpretation (Layer 2)
  short_summary: string;
  save_reason: string;
  appeal_signals: AppealSignals;
  style_descriptors: string[];
  mood_descriptors: string[];
  cultural_references: string[];
  taste_role: TasteRole[];
  aesthetic_axes: AestheticAxes;

  // Evidence/interpretation split
  observable_evidence: string[];
  interpretation: string[];
  confidence: number;  // 0.0–1.0

  // Visual analysis — null if no image available or analysis failed
  visual_analysis: VisualAnalysisProfile | null;

  // Embedding-ready (includes visual signals when available)
  vector_ready_text: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — PROFILE-LEVEL AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

export type ProfileAestheticAxes = {
  mainstream_vs_niche: number;
  loud_vs_quiet: number;
  utility_vs_aesthetic: number;
  literal_vs_interpretive: number;
  clean_vs_textured: number;
  corporate_vs_independent: number;
};

export type EvidenceCluster = {
  label: string;
  description: string;
  evidence_item_indices: number[];
  strength: number;  // 0.0–1.0
};

// ─── Signal tiers ──────────────────────────────────────────────────────────────

/** A claim with explicit evidence links and coverage. */
export type EvidencedClaim = {
  claim: string;
  evidence_item_indices: number[];
  coverage: number;       // fraction of total items that support this, 0.0–1.0
  confidence: number;     // 0.0–1.0
};

export type TasteProfileSummary = {
  /** Highly recurrent, multi-item backed signals */
  strong_signals: EvidencedClaim[];
  /** Appear in 2+ items but not dominant */
  emerging_signals: EvidencedClaim[];
  /** Appear in 1 item or weakly inferred — explicitly speculative */
  weak_hypotheses: EvidencedClaim[];

  visual_preferences: string[];
  conceptual_preferences: string[];
  emotional_preferences: string[];
  cultural_gravity: string[];
  preference_axes: ProfileAestheticAxes;

  /** Only populated when evidence is real — omit otherwise */
  likely_dislikes: EvidencedClaim[];
  /** Items they would probably save next, grounded in patterns */
  likely_likes_more_of: string[];

  evidence_backed_clusters: EvidenceCluster[];

  /** Language: "current saves suggest..." never "this person is..." */
  profile_summary_short: string;
  profile_summary_rich: string;
  vector_ready_text: string;
  confidence: number;
};

// ─── Taste psychology layer ────────────────────────────────────────────────────

/**
 * Non-clinical personality/cognition hypotheses inferred from saved links.
 *
 * GUARDRAILS (enforced in prompts and types):
 * - These are probabilistic inferences, not facts or diagnoses
 * - No mental health, trauma, attachment style, or intelligence claims
 * - No MBTI mapping
 * - No clinical terminology
 * - Language must be explicitly hedged: "save patterns suggest...", "tentatively..."
 */
export type TastePsychologyDimension = {
  label: string;
  /** e.g. "high" | "moderate-high" | "moderate" | "low" | "unclear" */
  estimated_level: string;
  /** 0.0–1.0 — keep low unless multiple items support it */
  confidence: number;
  evidence: string[];
  coverage_item_indices: number[];
};

export type PersonaBlendEntry = {
  archetype: string;      // e.g. "curatorial aesthete", "independent researcher"
  weight: number;         // 0.0–1.0, all weights should sum ~1.0
  rationale: string;      // 1 sentence, evidence-grounded
};

export type SelectionStyleDimension = {
  label: string;          // e.g. "curation_density", "authorship_sensitivity"
  tendency: string;       // e.g. "saves few, high-filter" / "saves broadly"
  confidence: number;
  evidence: string[];
};

export type TastePsychology = {
  /**
   * Explicit non-clinical disclaimer — always present in output.
   * Downstream models must treat this section as probabilistic inference only.
   */
  disclaimer: "This section contains probabilistic inferences from saved links only. It is non-clinical, non-diagnostic, and explicitly uncertain. Do not treat any claim here as fact.";

  trait_hypotheses: {
    openness_to_experience: TastePsychologyDimension;
    aesthetic_sensitivity: TastePsychologyDimension;
    need_for_cognition: TastePsychologyDimension;
    tolerance_for_ambiguity: TastePsychologyDimension;
    novelty_seeking: TastePsychologyDimension;
    independence_of_taste: TastePsychologyDimension;
    identity_signaling_via_curation: TastePsychologyDimension;
  };

  persona_blend: PersonaBlendEntry[];
  selection_style: SelectionStyleDimension[];

  /** 1–2 sentence synthesis — hedged, non-flattering, machine-targeted */
  synthesis: string;
  confidence: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// FULL DOSSIER
// ─────────────────────────────────────────────────────────────────────────────

export type TasteDossierV2 = {
  profile_id: string;
  profile_version: "taste_dossier_v2";
  generated_at: string;
  stats: {
    item_count: number;
    domain_count: number;
    language_mix: string[];
    source_mix: Record<string, number>;
    content_type_mix: Record<string, number>;
    has_vision_analysis: boolean;
    has_transcripts: boolean;
  };
  saved_items: ItemTasteProfile[];
  taste_summary: TasteProfileSummary;
  /** Aggregated visual language analysis across all items with images */
  visual_taste_summary: VisualTasteSummary | null;
  /** Non-clinical cognitive/aesthetic style hypotheses. Null if insufficient data (<4 items). */
  taste_psychology: TastePsychology | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY — kept for backward compat during transition, remove in v3
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use ItemTasteProfile instead */
export type AiLinkProfile = ItemTasteProfile & {
  // v1 compat shims so old stored JSON still parses
  schema_version?: number;
  normalized_url?: string;
  canonical_url?: string | null;
  content_type_legacy?: string;
  summary?: string;
  description?: string | null;
  favicon_url?: string | null;
  author_publisher?: string | null;
  publish_date?: string | null;
  main_image?: string | null;
  extracted_text_excerpt?: string;
  topics?: string[];
  tags?: string[];
  entities?: string[];
  mood_tone?: string[];
  aesthetic_style?: string[];
  format_classification?: string;
  language_guess?: string;
  safety_fetch_status?: string;
  vision_description?: string | null;
  user_note?: string | null;
};

/** @deprecated Use TasteDossierV2 instead */
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
