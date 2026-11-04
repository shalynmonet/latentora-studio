// Server-only Made for Me pipeline. Every Muse Spark call for this pathway lives here and
// is invoked from server functions only. Output is sanitized by made-for-me.ts rules.
import { META_MODELS, MetaUnavailableError, sparkJSON } from "./meta.server";
import {
  BUILDERS,
  PREFERENCES,
  accessibilityRequirements,
  assembleBuildPrompt,
  sanitizeConcepts,
  sanitizeDecisions,
  sanitizeNeeds,
  type ApprovedDetail,
  type Blueprint,
  type BlueprintFeature,
  type Customization,
  type DesignDecision,
  type EvidenceItem,
  type InferredNeed,
  type InventionFeedback,
  type Pathway,
  type Rationale,
  type Revision,
  type ToolConcept,
} from "./made-for-me";

const S = { type: "string" } as const;
const SA = { type: "array", items: S } as const;
const obj = (props: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(props),
  properties: props,
});

const GROUND_RULES = [
  "You are Latentora's Made for Me engine: you invent small, practical personal tools for ONE individual, aimed at personal elevation.",
  "Never propose startups, business plans, monetisation, market research, marketplaces or 'apps for everyone'. Never suggest a generic to-do list, habit tracker or note app unless its design addresses a specific need in the evidence.",
  "Only use the evidence provided. Never invent personal details, history, employers, family, health, disabilities or diagnoses. Never infer accessibility needs or limitations from someone's projects; accessibility comes only from preferences they explicitly chose.",
  "Cite evidence only by the exact ids given (e.g. 's1', 'c2', 'goal', 'p:voice_first'). If you are guessing, say so in assumptions.",
  "Prefer simple, achievable, free-to-run tools a person could build with an AI app builder in a weekend. No paid APIs, no hardware, no integrations the person hasn't mentioned.",
  "Plain, warm English. No numeric confidence scores.",
].join(" ");

async function spark<T>(schemaName: string, schema: Record<string, unknown>, system: string, user: unknown): Promise<T> {
  try {
    return await sparkJSON<T>({ schemaName, schema, system: `${GROUND_RULES} ${system}`, user: JSON.stringify(user) });
  } catch (e) {
    if (e instanceof MetaUnavailableError)
      throw new Error("Muse Spark is unavailable right now, so nothing was generated. Please try again in a moment.");
    if (e instanceof SyntaxError) throw new Error("Muse Spark's answer couldn't be read. Please try again.");
    throw e;
  }
}

const evidencePayload = (evidence: EvidenceItem[]) =>
  evidence.map((e) => ({ id: e.id, kind: e.kind, label: e.label, text: e.text }));

/* ------------------------------ discovery ------------------------------ */

const DISCOVERY_SCHEMA = obj({
  follow_up_questions: SA,
  inferred_needs: { type: "array", items: obj({ need: S, evidence_ids: SA }) },
  concepts: {
    type: "array",
    items: obj({
      name: S,
      what_it_does: S,
      why_for_you: S,
      evidence_ids: SA,
      what_becomes_possible: S,
      differs_from_generic: S,
      assumptions: SA,
    }),
  },
});

export interface DiscoveryInput {
  pathway: Pathway;
  evidence: EvidenceItem[];
  allowQuestions: boolean;
  round: number;
  rejectedConcepts: string[];
  rejectedNeeds: string[];
}

export async function runDiscovery(input: DiscoveryInput) {
  const raw = await spark<{ follow_up_questions: unknown; inferred_needs: unknown; concepts: unknown }>(
    "made_for_me_discovery",
    DISCOVERY_SCHEMA,
    [
      input.allowQuestions
        ? "If something essential is missing to design genuinely personal tools (e.g. what they've already tried, where/when the friction happens), return 1-3 short follow-up questions AND an empty concepts array. Otherwise return no questions."
        : "Do not ask questions; return an empty follow_up_questions array.",
      "inferred_needs: 2-4 underlying needs, each citing evidence ids.",
      "concepts: exactly three DISTINCT tool concepts (different interaction models, not variants of one idea).",
      "name: memorable and specific (not 'AI Assistant'). why_for_you: 1-3 sentences that refer to the person's own words or capabilities; evidence_ids must list what you relied on.",
      "differs_from_generic: name the generic tool category and the specific personal difference. assumptions: 1-3 things you're guessing that the person should confirm or correct.",
      "Avoid any concept or need listed as rejected.",
    ].join(" "),
    {
      pathway: input.pathway,
      evidence: evidencePayload(input.evidence),
      rejected_concepts: input.rejectedConcepts,
      rejected_needs: input.rejectedNeeds,
      round: input.round,
    },
  );
  const questions = input.allowQuestions
    ? (Array.isArray(raw.follow_up_questions) ? raw.follow_up_questions : [])
        .filter((q): q is string => typeof q === "string" && q.trim().length > 4)
        .map((q) => q.trim().slice(0, 200))
        .slice(0, 3)
    : [];
  const needs: InferredNeed[] = sanitizeNeeds(raw.inferred_needs, input.evidence);
  const concepts: ToolConcept[] = questions.length ? [] : sanitizeConcepts(raw.concepts, input.evidence, input.round);
  if (!questions.length && concepts.length < 2)
    throw new Error("Muse Spark's ideas weren't traceable to your own information, so they were discarded. Please try again.");
  return { follow_up_questions: questions, inferred_needs: needs, concepts, model: META_MODELS.spark };
}

/* ------------------------------ rationale ------------------------------ */

const RATIONALE_SCHEMA = obj({
  intro: S,
  decisions: { type: "array", items: obj({ because: S, decision: S, benefit: S, evidence_ids: SA }) },
});

export async function runRationale(concept: ToolConcept, c: Customization, evidence: EvidenceItem[]): Promise<Rationale> {
  const raw = await spark<{ intro: unknown; decisions: unknown }>(
    "made_for_me_rationale",
    RATIONALE_SCHEMA,
    [
      "Write 'Why I designed this for you': 4-7 major design decisions for the selected tool.",
      "because: second person, quoting or paraphrasing ONLY the cited evidence (e.g. 'You mentioned…', 'You chose…'). decision: the concrete design choice. benefit: the intended personal benefit.",
      "Every chosen accessibility preference (ids starting 'p:') must visibly change at least one decision — change the interaction model or features, not just add a checklist item.",
      "Respect the person's corrections: assumptions marked rejected must not be relied on; corrected ones use the correction.",
      "intro: one sentence summarising the design idea.",
    ].join(" "),
    {
      tool: concept,
      intended_outcome: c.outcome,
      assumptions: c.assumptions,
      evidence: evidencePayload(evidence),
    },
  );
  const decisions: DesignDecision[] = sanitizeDecisions(raw.decisions, evidence);
  if (decisions.length < 2) throw new Error("Muse Spark's design reasons weren't tied to your information. Please try again.");
  return { intro: typeof raw.intro === "string" ? raw.intro.slice(0, 400) : "", decisions, source: "meta_live", model: META_MODELS.spark };
}

/* ------------------------------ blueprint ------------------------------ */

const BLUEPRINT_SCHEMA = obj({
  purpose: S,
  user_requirements: SA,
  core_features: { type: "array", items: obj({ name: S, description: S, priority: { type: "string", enum: ["must", "should", "could"] } }) },
  interface: obj({
    layout: S,
    navigation: S,
    screens: { type: "array", items: obj({ name: S, purpose: S }) },
    interactions: SA,
    responsive: S,
  }),
  accessibility: SA,
  data_privacy: obj({ stores: SA, keep_private: SA, edit_delete: S }),
  architecture: SA,
  acceptance_tests: SA,
  first_use_validation: obj({ experiment: S, measures: SA, duration: S }),
  intended_benefit: S,
});

type RawBlueprint = Omit<
  Blueprint,
  "tool_name" | "builder" | "preferences" | "design_decisions" | "personal_context" | "build_prompt" | "source" | "model" | "generated_at"
>;

const clip = (a: unknown, n: number, len = 400) =>
  Array.isArray(a) ? a.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, len)).slice(0, n) : [];

export async function runBlueprint(opts: {
  concept: ToolConcept;
  customization: Customization;
  decisions: { decision: string; benefit: string }[];
  approved: ApprovedDetail[];
}): Promise<Blueprint> {
  const { concept, customization: c } = opts;
  const prefs = PREFERENCES.filter((p) => c.preferences.includes(p.key)).map((p) => p.label);
  const raw = await spark<RawBlueprint>(
    "made_for_me_blueprint",
    BLUEPRINT_SCHEMA,
    [
      `Write a production-oriented build blueprint for an AI app builder (${BUILDERS.find((b) => b.key === c.builder)?.label}).`,
      "Use ONLY the approved personal details given; do not add any other personal information.",
      "core_features: 4-8, prioritised (must/should/could), each essential to the person's outcome.",
      "interface.screens: 2-5 screens. accessibility: extra requirements specific to THIS tool's features that follow from the chosen preferences (baseline requirements are added separately).",
      "data_privacy: what is stored, what must stay private, and how the person edits/deletes it. Default to on-device storage.",
      "architecture: 3-6 realistic, free, low-cost implementation points for the selected builder. Never assume paid API access; browser APIs (Web Speech, IndexedDB, Notifications) are fine.",
      "acceptance_tests: 5-8 specific, checkable conditions. first_use_validation: a simple 1-2 week self-experiment with 2-3 measures fitting the goal (e.g. time saved, steps eliminated, tasks finished, independence).",
    ].join(" "),
    {
      tool: { name: concept.name, what_it_does: concept.what_it_does, what_becomes_possible: concept.what_becomes_possible, differs_from_generic: concept.differs_from_generic },
      intended_outcome: c.outcome,
      confirmed_assumptions: c.assumptions.filter((a) => a.status === "confirmed").map((a) => a.text),
      corrected_assumptions: c.assumptions.filter((a) => a.status === "corrected").map((a) => a.correction),
      design_decisions: opts.decisions,
      approved_personal_details: opts.approved.map((d) => d.text),
      chosen_preferences: prefs,
      custom_instructions: c.custom_instructions || null,
      builder: c.builder,
    },
  );
  const features: BlueprintFeature[] = (Array.isArray(raw.core_features) ? raw.core_features : [])
    .filter((f) => f && typeof f.name === "string")
    .slice(0, 8)
    .map((f) => ({ name: f.name.slice(0, 80), description: String(f.description ?? "").slice(0, 400), priority: ["must", "should", "could"].includes(f.priority) ? f.priority : "should" }));
  if (features.length < 2) throw new Error("Muse Spark's blueprint was incomplete. Please try again.");
  const ui = raw.interface ?? ({} as RawBlueprint["interface"]);
  const parts = {
    tool_name: concept.name,
    purpose: String(raw.purpose ?? "").slice(0, 800),
    user_requirements: clip(raw.user_requirements, 8),
    core_features: features,
    interface: {
      layout: String(ui.layout ?? "").slice(0, 500),
      navigation: String(ui.navigation ?? "").slice(0, 400),
      screens: (Array.isArray(ui.screens) ? ui.screens : []).slice(0, 6).map((s) => ({ name: String(s?.name ?? "").slice(0, 60), purpose: String(s?.purpose ?? "").slice(0, 300) })),
      interactions: clip(ui.interactions, 8),
      responsive: String(ui.responsive ?? "").slice(0, 400),
    },
    accessibility: clip(raw.accessibility, 8),
    data_privacy: {
      stores: clip(raw.data_privacy?.stores, 8),
      keep_private: clip(raw.data_privacy?.keep_private, 8),
      edit_delete: String(raw.data_privacy?.edit_delete ?? "").slice(0, 400),
    },
    architecture: clip(raw.architecture, 8),
    acceptance_tests: clip(raw.acceptance_tests, 10),
    first_use_validation: {
      experiment: String(raw.first_use_validation?.experiment ?? "").slice(0, 600),
      measures: clip(raw.first_use_validation?.measures, 4),
      duration: String(raw.first_use_validation?.duration ?? "").slice(0, 100),
    },
    intended_benefit: String(raw.intended_benefit ?? "").slice(0, 500),
    builder: c.builder,
    preferences: c.preferences,
    design_decisions: opts.decisions,
    personal_context: opts.approved,
  };
  // Baseline + preference requirements are always present, independent of the model.
  const a11y = accessibilityRequirements(c.preferences, c.custom_instructions);
  return {
    ...parts,
    build_prompt: assembleBuildPrompt(parts, c.custom_instructions),
    accessibility: Array.from(new Set([...a11y, ...parts.accessibility])),
    source: "meta_live",
    model: META_MODELS.spark,
    generated_at: new Date().toISOString(),
  };
}

/* ------------------------------- revision ------------------------------ */

const REVISION_SCHEMA = obj({
  summary: S,
  changes: { type: "array", items: obj({ section: S, change: S, because_you_said: S }) },
  keep: SA,
});

export async function runRevision(blueprint: Blueprint, feedback: InventionFeedback): Promise<Revision> {
  const raw = await spark<{ summary: string; changes: Revision["changes"]; keep: string[] }>(
    "made_for_me_revision",
    REVISION_SCHEMA,
    [
      "The person has reported back after building or trying their personal tool. Recommend 2-6 concrete revisions to the blueprint grounded ONLY in what they reported.",
      "because_you_said must quote or closely paraphrase their feedback. keep: features their feedback suggests are working.",
      "Do not claim the tool improved their life; this is self-reported feedback, not measured outcome. If they haven't built it yet, suggest ways to make the first build smaller and easier.",
    ].join(" "),
    {
      tool: blueprint.tool_name,
      purpose: blueprint.purpose,
      features: blueprint.core_features,
      preferences: blueprint.preferences,
      feedback,
    },
  );
  return {
    summary: String(raw.summary ?? "").slice(0, 500),
    changes: (Array.isArray(raw.changes) ? raw.changes : []).slice(0, 6).map((c) => ({
      section: String(c?.section ?? "").slice(0, 60),
      change: String(c?.change ?? "").slice(0, 400),
      because_you_said: String(c?.because_you_said ?? "").slice(0, 300),
    })),
    keep: clip(raw.keep, 6),
    source: "meta_live",
    model: META_MODELS.spark,
  };
}
