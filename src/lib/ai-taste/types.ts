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

  // Embedding-ready
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
