/**
 * Per-item pipeline: classification → visual analysis → semantic extraction → taste interpretation.
 * Produces SavedItemV4 with all layers populated.
 *
 * LLM is used for semantic + taste interpretation.
 * Classification uses a separate heuristic + optional LLM pass (classify-item.ts).
 * Visual analysis is handled by analyze-image.ts.
 */

import OpenAI from "openai";
import type {
  ImageType,
  ItemKind,
  PolishLevel,
  ProfileRouting,
  RelevanceScores,
  SavedItemV4,
  SaveIntent,
  SaveIntentBlock,
  SemanticLayer,
  TasteInterpretation,
  VisualLayer,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Blocklists
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_BLOCKLIST = new Set([
  "twitter","x","pinterest","telegram","youtube","instagram","tiktok",
  "readymag","substack","medium","notion","figma","dribbble","behance",
  "github","reddit","linkedin","facebook","vimeo","soundcloud",
]);

const RENDER_LABEL_BLOCKLIST = new Set([
  "web-landing","mixed-layout","open-graph-card","social-card","rich-embed",
  "thumbnail-led","conversation","messaging-ui","video-ui","embed","oembed",
  "og","fallback","web","article","image-forward","native-embed",
]);

function isGarbage(s: string): boolean {
  const n = s.toLowerCase().trim();
  return PLATFORM_BLOCKLIST.has(n) || RENDER_LABEL_BLOCKLIST.has(n) || n.length < 3 || /^\d+$/.test(n);
}

function filterTags(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter(s => {
    if (isGarbage(s) || seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM semantic + taste prompt
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_SYSTEM = `Optimize for correctness and taste discrimination, not for sounding insightful.
Prefer short, falsifiable statements. When evidence is weak, output less and lower scores — do not pad with generic insight.`;

const ITEM_PROMPT = `You are analyzing a saved link for a taste dossier (machine-readable, not prose for humans).
Produce two layers: semantic_layer (what it is) and taste_interpretation (routing + bounded why).

SUBJECT vs VISUAL (mandatory):
- semantic_layer / topic_tags may mention subject matter factually.
- save_reason and interpretation must NOT collapse "odd subject" into "saved for humor/meme".
  If VISUAL ANALYSIS lists execution/linework/palette/graphic attitude, prefer those as save drivers
  over literal subject nouns.
- Do not treat ethics/subject categories (recycled materials, sustainability, climate, CSR) as aesthetic drivers unless the visible graphic is literally about that and execution tokens support it.

ROUTING:
- Tools, parsers, API docs, AI workspaces, hosting dashboards, read-later articles without visual intent:
  affects_visual_profile=false, weight_in_aesthetic_aggregation <= 0.15, aesthetic_contamination_risk >= 0.7
- Only set affects_visual_profile=true when there is real visual-intent evidence (image-forward save,
  clear illustration/graphic/poster language in the preview, or VISUAL ANALYSIS shows non-template craft).

RULES:
- No platform names as taste signals
- No render labels as aesthetics
- should_affect_aesthetic_profile=false for tools, tutorials, articles with no visual evidence
- aesthetic_contamination_risk: 0.0=pure visual, 1.0=pure utility tool
- save_reason: ONE sentence; strongest supported driver only. If drivers are unclear, state what is observable (preview type, execution tokens) without psychologizing.
- observable_evidence: 2–3 directly checkable facts from URL/title/description/VISUAL ANALYSIS — no chain speculation
- interpretation: at most 2 strings; each must be a specific graphic or routing claim you could defend from observable_evidence. No "deeply suggests", "reveals", "speaks to who they are".

CRITICAL — DO NOT:
- Make evaluative judgments about the person (negative or positive)
- Infer limitations, weaknesses, deficits, or disconnects from sparse curation data
- Assume humorous, strange, or unusual imagery was saved for joke/meme value
  → Such imagery may be saved for linework, illustration style, graphic attitude,
    palette, composition, or subcultural visual language — infer visual qualities first
- Produce personality conclusions that outrun the evidence
- Weight single-item themes as strong signals — keep them local to observable_evidence
- If data is sparse: output less, not more; lower confidence instead of speculating

OUTPUT valid JSON only:
{
  "save_intent": {
    "primary": "visual_inspiration|mood_capture|identity_signal|cultural_signal|read_later|practical_reference|tool_for_future_use|workflow_resource|research",
    "secondary": [],
    "confidence": 0.0
  },
  "relevance": {
    "taste_relevance": 0.0,
    "visual_taste_relevance": 0.0,
    "cultural_taste_relevance": 0.0,
    "utility_relevance": 0.0,
    "workflow_relevance": 0.0,
    "identity_signal_relevance": 0.0
  },
  "profile_routing": {
    "affects_visual_profile": true,
    "affects_cultural_profile": false,
    "affects_utility_profile": false,
    "affects_workflow_profile": false,
    "affects_persona_profile": true
  },
  "semantic_layer": {
    "short_summary": "1 sentence: factual description of the link",
    "topic_tags": ["3-5 tags, no platform names"],
    "use_case": "inspiration|reference|learning|tool|entertainment|research|mood",
    "confidence": 0.0
  },
  "taste_interpretation": {
    "should_affect_aesthetic_profile": true,
    "should_affect_cultural_profile": false,
    "weight_in_aesthetic_aggregation": 0.0,
    "weight_in_cultural_aggregation": 0.0,
    "weight_in_utility_aggregation": 0.0,
    "aesthetic_contamination_risk": 0.0,
    "save_reason": "1 sentence causal inference",
    "observable_evidence": ["2-3 directly observable facts"],
    "interpretation": ["0-2 specific, evidence-tethered inferences only"],
    "confidence": 0.0
  }
}`;

interface LlmItemResult {
  save_intent: SaveIntentBlock;
  relevance: RelevanceScores;
  profile_routing: ProfileRouting;
  semantic_layer: SemanticLayer;
  taste_interpretation: TasteInterpretation;
}

function buildContext(input: BuildLinkProfileInput): string {
  const parts: string[] = [
    `URL: ${input.url}`,
    `Domain: ${input.domain}`,
  ];
  if (input.title) parts.push(`Title: ${input.title}`);
  if (input.siteName) parts.push(`Site: ${input.siteName}`);
  if (input.description) parts.push(`Description: ${input.description.slice(0, 250)}`);
  if (input.extractedText) parts.push(`Text excerpt: ${input.extractedText.slice(0, 800)}`);
  if (input.userNote) parts.push(`User note: ${input.userNote}`);
  if (input.visualProfile) {
    const v = input.visualProfile;
    parts.push([
      `VISUAL ANALYSIS:`,
      `  Type: ${v.image_type}, Depicted (subject): ${v.depicted ?? "unknown"}`,
      `  Execution (linework/render/texture): ${v.execution_read ?? "n/a"}`,
      `  Non-subject attraction: ${v.non_subject_attraction ?? "n/a"}`,
      `  Composition: ${v.composition}`,
      `  Color: ${v.color_profile?.description}`,
      `  Style signals: ${v.stylistic_signals?.join(", ")}`,
      `  Authorship: ${v.authorship_signal}`,
      `  Visual attraction (graphic read): ${v.visual_attraction}`,
    ].filter(Boolean).join("\n"));
  } else if (input.visionDescription) {
    parts.push(`Visual: ${input.visionDescription}`);
  }
  return parts.join("\n");
}

function cloneLlm(llm: LlmItemResult): LlmItemResult {
  return {
    ...llm,
    save_intent: { ...llm.save_intent, secondary: [...llm.save_intent.secondary] },
    relevance: { ...llm.relevance },
    profile_routing: { ...llm.profile_routing },
    semantic_layer: { ...llm.semantic_layer },
    taste_interpretation: {
      ...llm.taste_interpretation,
      observable_evidence: [...llm.taste_interpretation.observable_evidence],
      interpretation: [...llm.taste_interpretation.interpretation],
    },
  };
}

/** Strong utility hosts / UI surfaces must not write the aesthetic graph unless image-only save */
function applyUtilityVisualGuards(input: BuildLinkProfileInput, llm: LlmItemResult): LlmItemResult {
  const out = cloneLlm(llm);
  const dom = normalizeDomain(input.domain);
  const imageLikeProvider = ["image", "pinterest-brand"].includes(input.provider);
  const toolHost = TOOL_DOMAINS.has(dom);
  const imgKind = (input.visualProfile?.image_type ?? "").toLowerCase();
  const uiSkew = /ui|dashboard|console|devtools|\bide\b|oauth|settings panel/i.test(imgKind)
    || /ui-?screenshot|ui_screenshot/.test(imgKind);

  if (toolHost && !imageLikeProvider) {
    out.profile_routing.affects_visual_profile = false;
    out.taste_interpretation.should_affect_aesthetic_profile = false;
    out.taste_interpretation.weight_in_aesthetic_aggregation = parseFloat(
      Math.min(out.taste_interpretation.weight_in_aesthetic_aggregation, 0.1).toFixed(2),
    );
    out.taste_interpretation.aesthetic_contamination_risk = parseFloat(
      Math.max(out.taste_interpretation.aesthetic_contamination_risk, 0.85).toFixed(2),
    );
    out.relevance.visual_taste_relevance = parseFloat(Math.min(out.relevance.visual_taste_relevance, 0.2).toFixed(2));
    return out;
  }

  const utilPrimary =
    out.save_intent.primary === "tool_for_future_use" ||
    out.save_intent.primary === "workflow_resource";
  if (
    utilPrimary &&
    out.relevance.utility_relevance >= 0.6 &&
    out.relevance.visual_taste_relevance < 0.55
  ) {
    out.profile_routing.affects_visual_profile = false;
    out.taste_interpretation.weight_in_aesthetic_aggregation = parseFloat(
      Math.min(out.taste_interpretation.weight_in_aesthetic_aggregation, 0.14).toFixed(2),
    );
  }

  if (uiSkew && out.relevance.utility_relevance >= 0.42 && out.taste_interpretation.aesthetic_contamination_risk >= 0.35) {
    out.profile_routing.affects_visual_profile = false;
    out.taste_interpretation.should_affect_aesthetic_profile = false;
    out.taste_interpretation.weight_in_aesthetic_aggregation = parseFloat(
      Math.min(out.taste_interpretation.weight_in_aesthetic_aggregation, 0.12).toFixed(2),
    );
  }

  return out;
}

function itemKindFromLlm(llm: LlmItemResult): ItemKind {
  const p = llm.save_intent.primary;
  if (p === "tool_for_future_use" || p === "workflow_resource") return "tool";
  if (p === "cultural_signal") return "cultural_reference";
  if (p === "visual_inspiration" || p === "mood_capture") return "visual_reference";
  if (p === "read_later" || p === "practical_reference" || p === "research") return "article";
  if (llm.semantic_layer.use_case === "tool") return "tool";
  if (llm.semantic_layer.use_case === "learning") return "tutorial";
  return "mixed";
}

function authorshipNumeric(auth?: string): number {
  const a = (auth ?? "neutral").toLowerCase();
  if (/\bnon[\s-]*template\b/.test(a)) return 0.68;
  if (/\balgorithmic\b/.test(a)) return 0.12;
  if (/\btemplate\b/.test(a)) return 0.22;
  if (/strongly\s*authored|strongly-authored/.test(a)) return 0.88;
  if (/\bauthored\b/.test(a)) return 0.72;
  if (/\bneutral\b/.test(a)) return 0.48;
  return 0.45;
}

/** Vision often says "neutral" for non-stock illustration; boost from tokens + execution so authored boards don't read as "low authorship". */
function authorshipScoreFromVision(vp: NonNullable<BuildLinkProfileInput["visualProfile"]>): number {
  let base = authorshipNumeric(vp.authorship_signal);
  const a = (vp.authorship_signal ?? "").toLowerCase();
  const isTemplateOrStock =
    /\balgorithmic\b/.test(a) ||
    (/\b(stock|template)\b/.test(a) && !/\bnon[\s-]*template\b/.test(a));
  if (isTemplateOrStock) return Math.min(base, 0.34);

  const sig = [...(vp.stylistic_signals ?? [])].join(" ").toLowerCase();
  const depicted = (vp.depicted ?? "").toLowerCase();
  const prose = `${vp.execution_read ?? ""} ${vp.non_subject_attraction ?? ""} ${vp.visual_attraction ?? ""}`.toLowerCase();
  const blob = `${sig} ${prose} ${depicted}`;
  const authoredCue =
    /authored|hand-?made|anti-?template|non-?template|editorial|zine|riso|risograph|letterpress|illustration|linework|contour|brush\s*ink|marker|collage|graphic\s*attitude|poster-?like|vernacular|internet-native|subcultural|indie|diy|lo-fi|raw-graphic|halftone|grain|xerox|photocopy|bespoke|custom\s+type|title\s+treatment|title\s+card|film\s+still|cine(still|matograph)|director|scene\s+composition|shader|generative|webgl|glsl|ray-?marched|3d\s+(scene|render)(?!\s+stock)/i;
  if (authoredCue.test(blob)) base = Math.max(base, 0.58);
  if (/strongly\s*authored/i.test(a)) base = Math.max(base, 0.86);
  if (/\bauthored\b/i.test(a) && !isTemplateOrStock) base = Math.max(base, 0.7);

  const it = (vp.image_type ?? "").toLowerCase();
  if (/(illustration|graphic-design|collage|poster|pin-board|mixed|3d-render|film-still|photography)/.test(it)) base = Math.max(base, 0.54);
  const execLen = (vp.execution_read ?? "").trim().length;
  if (execLen >= 90 && !/\b(stock|template\s+photo|shutterstock)\b/i.test(prose)) base = Math.max(base, 0.55);

  return Math.min(1, Math.max(0.14, base));
}

function polishFromAuthorship(auth?: string, novelty = 0.5): PolishLevel {
  const a = (auth ?? "neutral").toLowerCase();
  if (a.includes("algorithmic")) return "highly-polished";
  if (a.includes("template")) return "refined";
  if (a.includes("strongly authored")) return novelty > 0.55 ? "raw" : "lo-fi";
  if (a.includes("authored")) return novelty > 0.62 ? "raw" : "lo-fi";
  return "mixed";
}

function polishLevelFromVision(
  authSig: string | undefined,
  novelty: number,
  stylistic: string[],
): PolishLevel {
  const s = stylistic.join(" ").toLowerCase();
  if (/corporate\s+clean|saas\s+ui|dashboard\s+ui|minimal\s+ui|template\s+layout/i.test(s)) return "refined";
  if (/lo-fi|raw-graphic|grain|halftone|riso|zine|xerox|photocopy|rough\s+ink|marker|collage|diy|scrappy/i.test(s)) {
    return novelty > 0.48 ? "raw" : "lo-fi";
  }
  return polishFromAuthorship(authSig, novelty);
}

async function extractWithLlm(
  input: BuildLinkProfileInput,
  client: OpenAI
): Promise<LlmItemResult | null> {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 900,
      temperature: 0.06,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${ITEM_SYSTEM}\n\n${ITEM_PROMPT}` },
        { role: "user", content: buildContext(input) },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as LlmItemResult;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic classification
// ─────────────────────────────────────────────────────────────────────────────

function normalizeDomain(d: string): string {
  return d.replace(/^www\./i, "").toLowerCase();
}

const TOOL_DOMAINS = new Set([
  "github.com","gitlab.com","bitbucket.org",
  "npmjs.com","pypi.org","crates.io","packagist.org",
  "vercel.com","netlify.com","railway.app","render.com","fly.io",
  "supabase.com","neon.tech","planetscale.com",
  "figma.com","notion.com","linear.app","airtable.com","clickup.com","asana.com",
  "zapier.com","make.com","n8n.io","retool.com","cloudflare.com",
  "stackoverflow.com","developer.mozilla.org","producthunt.com",
  "openai.com","platform.openai.com","chatgpt.com","anthropic.com","claude.ai",
  "replicate.com","huggingface.co","perplexity.ai","colab.research.google.com",
  "regex101.com","regexr.com","jsonlint.com","jqplay.org",
  "codesandbox.io","stackblitz.com","jsfiddle.net","replit.com",
  "cursor.com","cursor.sh","v0.dev","bolt.new","eigent.ai",
  "readthedocs.io","readme.io","swagger.io","postman.com",
]);
const ARTICLE_DOMAINS = new Set([
  "medium.com","substack.com","dev.to","hashnode.com","nytimes.com",
  "theguardian.com","wired.com","techcrunch.com","hbr.org","bloomberg.com",
]);
const VISUAL_DOMAINS = new Set([
  "pinterest.com","are.na","behance.net","dribbble.com","cargo.site",
  "unsplash.com","itsnicethat.com","dezeen.com","awwwards.com","siteinspire.com",
]);
const CULTURAL_DOMAINS = new Set([
  "letterboxd.com","mubi.com","criterion.com","bandcamp.com",
  "artsy.net","artforum.com","e-flux.com","frieze.com","goodreads.com",
]);
const TOOL_PATTERNS = [
  /\b(how to|tutorial|guide|documentation|api reference|getting started|install|setup|deploy)\b/i,
  /\b(library|framework|package|plugin|sdk|cli|tool|utility)\b/i,
];

/** Strip subject-matter / ethics topics from vision tokens — they are not visual-language axes */
const SUBJECT_TOPIC_TOKEN_RE =
  /recycl|sustainab|eco[\s-]?|circular\b|upcycl|carbon\b|climate\b|biodegrad|zero[\s-]?waste|greenwashing|esg\b|csr\b/i;

function stripTopicStylisticTokens(arr: string[]): string[] {
  return arr.filter(s => !SUBJECT_TOPIC_TOKEN_RE.test(s));
}

function heuristicResult(input: BuildLinkProfileInput): LlmItemResult {
  const d = normalizeDomain(input.domain);
  const t = (input.title ?? "") + " " + (input.description ?? "");
  const isVisual =
    VISUAL_DOMAINS.has(d) ||
    d.includes("pinterest.") ||
    ["image", "pinterest-brand"].includes(input.provider);
  const isCultural = CULTURAL_DOMAINS.has(d);
  const isTool = TOOL_DOMAINS.has(d) || TOOL_PATTERNS.some(p => p.test(t));
  const isArticle = ARTICLE_DOMAINS.has(d) || input.provider === "article";
  const isVideo = ["youtube","video"].includes(input.provider);
  const isSocial = ["twitter","telegram","instagram"].includes(input.provider);

  let itemKind: ItemKind;
  let primaryIntent: SaveIntent;
  let contaminationRisk: number;

  const imageLikeProvider = ["image", "pinterest-brand"].includes(input.provider);

  if (isVisual) { itemKind = "visual_reference"; primaryIntent = "visual_inspiration"; contaminationRisk = 0.05; }
  else if (isCultural) { itemKind = "cultural_reference"; primaryIntent = "cultural_signal"; contaminationRisk = 0.1; }
  else if (isTool && !imageLikeProvider) { itemKind = "tool"; primaryIntent = "tool_for_future_use"; contaminationRisk = 0.9; }
  else if (isTool && imageLikeProvider) { itemKind = "visual_reference"; primaryIntent = "visual_inspiration"; contaminationRisk = 0.2; }
  else if (isArticle) { itemKind = "article"; primaryIntent = "read_later"; contaminationRisk = 0.65; }
  else if (isVideo) { itemKind = "video"; primaryIntent = "mood_capture"; contaminationRisk = 0.3; }
  else if (isSocial) { itemKind = "social_post"; primaryIntent = input.imageUrl ? "visual_inspiration" : "cultural_signal"; contaminationRisk = 0.3; }
  else { itemKind = "mixed"; primaryIntent = "research"; contaminationRisk = 0.5; }

  const visualRel = isVisual ? 0.9 : isSocial && !!input.imageUrl ? 0.5 : contaminationRisk < 0.4 ? 0.4 : 0.1;
  const culturalRel = isCultural ? 0.9 : isSocial ? 0.5 : contaminationRisk < 0.4 ? 0.3 : 0.1;
  const utilityRel = isTool ? 0.9 : isArticle ? 0.6 : 0.2;
  const wAesthetic = Math.max(0, parseFloat((1 - contaminationRisk).toFixed(2)));

  return {
    save_intent: { primary: primaryIntent, secondary: [], confidence: 0.5 },
    relevance: {
      taste_relevance: contaminationRisk < 0.5 ? 0.7 : 0.3,
      visual_taste_relevance: visualRel,
      cultural_taste_relevance: culturalRel,
      utility_relevance: utilityRel,
      workflow_relevance: isTool ? 0.7 : isArticle ? 0.4 : 0.1,
      identity_signal_relevance: isCultural ? 0.7 : isVisual ? 0.6 : isSocial ? 0.5 : 0.2,
    },
    profile_routing: {
      affects_visual_profile: isTool && !imageLikeProvider ? false : visualRel >= 0.4,
      affects_cultural_profile: culturalRel >= 0.4,
      affects_utility_profile: utilityRel >= 0.4,
      affects_workflow_profile: isTool,
      affects_persona_profile: contaminationRisk < 0.5,
    },
    semantic_layer: {
      short_summary: input.description?.slice(0, 200) || input.title || input.domain,
      topic_tags: filterTags([input.domain.split(".")[0], itemKind]),
      use_case: primaryIntent === "visual_inspiration" ? "inspiration"
        : primaryIntent === "tool_for_future_use" ? "tool"
        : primaryIntent === "read_later" ? "reference"
        : "inspiration",
      confidence: 0.4,
    },
    taste_interpretation: {
      should_affect_aesthetic_profile: isTool && !imageLikeProvider ? false : contaminationRisk < 0.5,
      should_affect_cultural_profile: culturalRel >= 0.4,
      weight_in_aesthetic_aggregation: isTool && !imageLikeProvider ? 0.08 : wAesthetic,
      weight_in_cultural_aggregation: parseFloat(culturalRel.toFixed(2)),
      weight_in_utility_aggregation: parseFloat(utilityRel.toFixed(2)),
      aesthetic_contamination_risk: contaminationRisk,
      save_reason: `Heuristic: classified as ${itemKind} with intent ${primaryIntent}.`,
      observable_evidence: [input.title ?? input.domain],
      interpretation: ["Low-confidence heuristic — LLM key not set."],
      confidence: 0.35,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual layer builder
// ─────────────────────────────────────────────────────────────────────────────

function buildVisualLayer(
  hasImage: boolean,
  vp: BuildLinkProfileInput["visualProfile"],
  visionString: string | null | undefined
): VisualLayer {
  if (!hasImage) {
    return {
      present: false, importance: 0, depicted_subject: [], image_type: "unknown",
      composition: [], color_tone: [], texture_materiality: [], polish_level: "mixed",
      visual_authorship: 0, visual_oddity: 0, stylistic_signals: [], cultural_signal: [],
      emotional_tone: [], confidence: 0,
    };
  }

  if (vp) {
    const colorTone: string[] = [];
    if (vp.color_profile?.saturation) colorTone.push(vp.color_profile.saturation);
    if (vp.color_profile?.temperature) colorTone.push(vp.color_profile.temperature);
    const novelty = typeof vp.visual_novelty === "number" ? Math.min(1, Math.max(0, vp.visual_novelty)) : 0.4;
    const sigs = stripTopicStylisticTokens(filterTags([...(vp.stylistic_signals ?? [])]));
    if (vp.controlled_weirdness?.trim()) sigs.push(vp.controlled_weirdness.trim().slice(0, 48));
    const authScore = authorshipScoreFromVision(vp);
    return {
      present: true,
      importance: Math.min(1, Math.max(0.2, (vp.confidence ?? 0.55) * 0.65 + novelty * 0.35)),
      depicted_subject: vp.depicted ? [vp.depicted] : [],
      image_type: (vp.image_type as ImageType) ?? "unknown",
      composition: vp.composition ? [vp.composition] : [],
      color_tone: colorTone.length ? colorTone : (vp.color_profile?.dominant_hues ?? []),
      texture_materiality: vp.materiality ?? [],
      polish_level: polishLevelFromVision(vp.authorship_signal, novelty, sigs),
      visual_authorship: authScore,
      visual_oddity: novelty,
      stylistic_signals: stripTopicStylisticTokens(filterTags(sigs)),
      cultural_signal: [],
      emotional_tone: (vp.emotional_tone ?? []).filter(t => !SUBJECT_TOPIC_TOKEN_RE.test(t)),
      confidence: Math.min(0.95, Math.max(0.18, vp.confidence ?? 0.55)),
      graphic_execution_read: vp.execution_read?.trim() || undefined,
      visual_attraction_hypothesis: [vp.non_subject_attraction, vp.visual_attraction]
        .filter(Boolean)
        .join(" ")
        .trim()
        .slice(0, 420) || undefined,
    };
  }

  if (visionString) {
    return {
      present: true, importance: 0.5, depicted_subject: [visionString.slice(0, 80)],
      image_type: "unknown", composition: [], color_tone: [], texture_materiality: [],
      polish_level: "mixed", visual_authorship: 0.5, visual_oddity: 0.5,
      stylistic_signals: [], cultural_signal: [], emotional_tone: [], confidence: 0.3,
    };
  }

  return {
    present: true, importance: 0.3, depicted_subject: [], image_type: "unknown",
    composition: [], color_tone: [], texture_materiality: [], polish_level: "mixed",
    visual_authorship: 0, visual_oddity: 0, stylistic_signals: [], cultural_signal: [],
    emotional_tone: [], confidence: 0.2,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vector text
// ─────────────────────────────────────────────────────────────────────────────

function buildVectorText(
  llm: LlmItemResult,
  vl: VisualLayer,
  title: string | null
): string {
  const parts: string[] = [];
  if (title) parts.push(title);
  parts.push(llm.semantic_layer.short_summary);
  parts.push(`Save intent: ${llm.save_intent.primary}`);
  parts.push(`Save reason: ${llm.taste_interpretation.save_reason}`);
  if (vl.stylistic_signals.length) parts.push(`Visual style: ${vl.stylistic_signals.join(", ")}`);
  if (vl.emotional_tone.length) parts.push(`Visual mood: ${vl.emotional_tone.join(", ")}`);
  if (vl.texture_materiality.length) parts.push(`Materiality: ${vl.texture_materiality.join(", ")}`);
  if (vl.graphic_execution_read) parts.push(`Graphic execution: ${vl.graphic_execution_read}`);
  if (vl.visual_attraction_hypothesis) parts.push(`Visual attraction read: ${vl.visual_attraction_hypothesis}`);
  if (llm.taste_interpretation.interpretation.length) parts.push(`Interpretation: ${llm.taste_interpretation.interpretation.join(" ")}`);
  parts.push(`Aesthetic weight: ${llm.taste_interpretation.weight_in_aesthetic_aggregation.toFixed(2)}`);
  return parts.filter(Boolean).join("; ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public input type + main function
// ─────────────────────────────────────────────────────────────────────────────

export type BuildLinkProfileInput = {
  normalizedUrl: string;
  url: string;
  canonicalUrl: string | null | undefined;
  title: string | null | undefined;
  description: string | null | undefined;
  domain: string;
  provider: string;
  previewType: string;
  imageUrl: string | null | undefined;
  faviconUrl: string | null | undefined;
  siteName: string | null | undefined;
  author: string | null | undefined;
  publishedAt: Date | null | undefined;
  extractedText: string | null | undefined;
  oEmbedAuthor?: string | null;
  visionDescription?: string | null;
  visualProfile?: {
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
    execution_read?: string;
    controlled_weirdness?: string;
    non_subject_attraction?: string;
    confidence?: number;
  } | null;
  userNote?: string | null;
};

export async function buildLinkAiProfileAsync(
  input: BuildLinkProfileInput,
  apiKey?: string | null,
  itemIndex = 0
): Promise<SavedItemV4> {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  let llmResult: LlmItemResult | null = null;

  if (key) {
    const client = new OpenAI({ apiKey: key });
    llmResult = await extractWithLlm(input, client);
  }
  if (!llmResult) llmResult = heuristicResult(input);
  llmResult = applyUtilityVisualGuards(input, llmResult);

  const visualLayer = buildVisualLayer(Boolean(input.imageUrl), input.visualProfile, input.visionDescription);
  const vectorText = buildVectorText(llmResult, visualLayer, input.title ?? null);

  return {
    item_index: itemIndex,
    url: input.url,
    domain: input.domain,
    canonical_url: input.canonicalUrl ?? null,
    title: input.title ?? null,
    item_kind: itemKindFromLlm(llmResult),
    content_format: input.provider,
    source_kind: input.provider,
    save_intent: llmResult.save_intent,
    relevance: llmResult.relevance,
    profile_routing: llmResult.profile_routing,
    visual_layer: visualLayer,
    semantic_layer: llmResult.semantic_layer,
    taste_interpretation: llmResult.taste_interpretation,
    vector_ready_text: vectorText,
  };
}

/** Sync fallback for legacy callers */
export function buildLinkAiProfile(input: BuildLinkProfileInput): SavedItemV4 {
  const llm = heuristicResult(input);
  const vl = buildVisualLayer(Boolean(input.imageUrl), input.visualProfile, input.visionDescription);
  return {
    item_index: 0,
    url: input.url,
    domain: input.domain,
    canonical_url: input.canonicalUrl ?? null,
    title: input.title ?? null,
    item_kind: "mixed",
    content_format: input.provider,
    source_kind: input.provider,
    save_intent: llm.save_intent,
    relevance: llm.relevance,
    profile_routing: llm.profile_routing,
    visual_layer: vl,
    semantic_layer: llm.semantic_layer,
    taste_interpretation: llm.taste_interpretation,
    vector_ready_text: buildVectorText(llm, vl, input.title ?? null),
  };
}
