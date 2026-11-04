// Made for Me — client-safe types and deterministic rules.
// Muse Spark proposes concepts, rationales and blueprint content; everything here
// (evidence tracing, fact/hypothesis labels, accessibility requirements, prompt
// assembly, export) is plain TypeScript so it can be tested and never invents facts.
import type { ResultSource } from "./types";

export type Pathway = "achieve" | "easier" | "both";
export type Builder = "lovable" | "codex" | "neutral";

/** stated = the person wrote it; demonstrated/tested = Atlas; hypothesis = AI inference; preference = chosen in the panel. */
export type EvidenceKind = "stated" | "demonstrated" | "tested" | "hypothesis" | "preference";

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  label: string;
  text: string;
}

export interface InferredNeed {
  id: string;
  need: string;
  evidence_ids: string[];
  basis: "stated" | "hypothesis";
}

export interface ToolConcept {
  id: string;
  name: string;
  what_it_does: string;
  why_for_you: string;
  evidence_ids: string[];
  what_becomes_possible: string;
  differs_from_generic: string;
  assumptions: string[];
}

export interface Discovery {
  follow_up_questions: string[];
  inferred_needs: InferredNeed[];
  concepts: ToolConcept[];
  evidence: EvidenceItem[];
  round: number;
  source: ResultSource;
  model: string | null;
}

export type AssumptionStatus = "unreviewed" | "confirmed" | "corrected" | "rejected";

export interface Customization {
  outcome: string;
  assumptions: { text: string; status: AssumptionStatus; correction: string }[];
  preferences: PreferenceKey[];
  custom_instructions: string;
  builder: Builder;
}

export interface DesignDecision {
  id: string;
  because: string;
  decision: string;
  benefit: string;
  evidence_ids: string[];
  /** Derived from the evidence kinds, never from the model. */
  basis: "stated" | "preference" | "hypothesis";
}

export interface Rationale {
  intro: string;
  decisions: DesignDecision[];
  source: ResultSource;
  model: string | null;
}

/** A personal detail the person approved (and possibly edited) for the build prompt. */
export interface ApprovedDetail {
  id: string;
  text: string;
}

export interface BlueprintFeature {
  name: string;
  description: string;
  priority: "must" | "should" | "could";
}

export interface Blueprint {
  tool_name: string;
  purpose: string;
  user_requirements: string[];
  core_features: BlueprintFeature[];
  interface: { layout: string; navigation: string; screens: { name: string; purpose: string }[]; interactions: string[]; responsive: string };
  accessibility: string[];
  data_privacy: { stores: string[]; keep_private: string[]; edit_delete: string };
  architecture: string[];
  acceptance_tests: string[];
  first_use_validation: { experiment: string; measures: string[]; duration: string };
  intended_benefit: string;
  builder: Builder;
  preferences: PreferenceKey[];
  design_decisions: { decision: string; benefit: string }[];
  personal_context: ApprovedDetail[];
  build_prompt: string;
  source: ResultSource;
  model: string | null;
  generated_at: string;
}

export interface InventionFeedback {
  built: "yes" | "partly" | "no";
  used: "yes" | "a_little" | "no";
  worked: string;
  didnt_work: string;
  helped: "yes" | "somewhat" | "no" | "too_early";
  change: string;
  submitted_at: string;
}

export interface Revision {
  summary: string;
  changes: { section: string; change: string; because_you_said: string }[];
  keep: string[];
  source: ResultSource;
  model: string | null;
}

export interface Invention {
  id: string;
  pathway: Pathway;
  ambition: string;
  friction: string;
  working_style: string;
  answers: { question: string; answer: string }[];
  discovery: Discovery | null;
  rejected: string[];
  selected: ToolConcept | null;
  customization: Customization | null;
  rationale: Rationale | null;
  approved_details: ApprovedDetail[] | null;
  blueprint: Blueprint | null;
  feedback: InventionFeedback | null;
  revision: Revision | null;
  build: import("./build-rules").MuseBuild | null;
  saved: boolean;
  created_at: string;
  updated_at: string;
}

/* ------------------------- accessibility catalogue ------------------------- */

export const PREFERENCES = [
  {
    key: "voice_first",
    label: "Voice-first interaction",
    hint: "Speak instead of type where possible",
    requirements: [
      "Every primary action can be started by voice using the browser's built-in Web Speech API where supported, with a large visible microphone button.",
      "Show the live transcript and let the person confirm or edit it before anything is saved.",
      "Always keep a typed fallback for browsers without speech recognition.",
    ],
  },
  {
    key: "visual_first",
    label: "Visual-first interaction",
    hint: "See things laid out, not listed",
    requirements: [
      "Represent items spatially (board, map or canvas) with drag-to-arrange, not only as text lists.",
      "Use colour plus icons/labels to group items; never colour alone.",
    ],
  },
  {
    key: "keyboard_only",
    label: "Keyboard-only navigation",
    hint: "Everything reachable without a mouse",
    requirements: [
      "Every action is reachable with Tab/Shift+Tab, Enter and Space, with a clearly visible focus ring.",
      "Provide documented single-key shortcuts for the main actions and a shortcut help panel (press ?).",
      "No keyboard traps; modals return focus to the element that opened them.",
    ],
  },
  {
    key: "screen_reader",
    label: "Screen-reader-friendly layout",
    hint: "Clear structure for assistive tech",
    requirements: [
      "Use semantic landmarks (header, nav, main) and a logical heading order on every screen.",
      "All controls have accessible names; status changes are announced through an aria-live region.",
      "Any spatial or visual view has an equivalent ordered list view.",
    ],
  },
  {
    key: "large_text",
    label: "Large text and controls",
    hint: "Bigger type and touch targets",
    requirements: [
      "Base text at least 18px, scalable to 200% without loss of content or horizontal scrolling.",
      "Touch/click targets at least 48×48px with generous spacing.",
    ],
  },
  {
    key: "reduced_motion",
    label: "Reduced motion",
    hint: "No unnecessary animation",
    requirements: [
      "Respect prefers-reduced-motion and offer an in-app 'reduce motion' switch; no parallax, auto-playing or looping animation.",
    ],
  },
  {
    key: "high_contrast",
    label: "High contrast",
    hint: "Strong contrast between text and background",
    requirements: [
      "Text and essential icons meet WCAG AAA contrast (7:1) in the default theme, with an optional high-contrast theme.",
    ],
  },
  {
    key: "step_by_step",
    label: "Simplified, step-by-step workflows",
    hint: "One thing at a time",
    requirements: [
      "Break multi-part tasks into one step per screen with a clear 'Step X of Y' indicator and Back/Next.",
      "Show only the single next action prominently; secondary options sit behind a 'More' control.",
    ],
  },
  {
    key: "low_distraction",
    label: "Low-distraction interface",
    hint: "Calm, minimal screens",
    requirements: [
      "No badges, counters, streaks or notifications unless the person turns them on.",
      "A focus mode that hides everything except the current item.",
    ],
  },
  {
    key: "flexible_pacing",
    label: "Flexible pacing",
    hint: "No timers or deadlines pushing you",
    requirements: [
      "No time limits or session timeouts that lose work; autosave continuously.",
      "Let the person pause and resume any flow exactly where they left off.",
    ],
  },
  {
    key: "minimal_typing",
    label: "Minimal required typing",
    hint: "Tap, pick or speak instead",
    requirements: [
      "Prefer choices, chips, templates and recent-value suggestions over free-text fields.",
      "No required free-text field longer than a short phrase.",
    ],
  },
] as const;

export type PreferenceKey = (typeof PREFERENCES)[number]["key"];
export const PREFERENCE_KEYS = PREFERENCES.map((p) => p.key) as PreferenceKey[];
export const preferenceLabel = (k: PreferenceKey) => PREFERENCES.find((p) => p.key === k)?.label ?? k;

/** Concrete, non-negotiable requirements for the chosen preferences. Deterministic. */
export function accessibilityRequirements(prefs: readonly string[], custom = ""): string[] {
  const out: string[] = [
    "Meets WCAG 2.2 AA as a baseline: semantic HTML, labelled controls, visible focus, sufficient contrast.",
  ];
  for (const p of PREFERENCES) if (prefs.includes(p.key)) out.push(...p.requirements);
  if (custom.trim()) out.push(`The person's own instruction (authoritative): ${custom.trim()}`);
  return out;
}

export function preferenceEvidence(prefs: readonly string[], custom = ""): EvidenceItem[] {
  const items: EvidenceItem[] = PREFERENCES.filter((p) => prefs.includes(p.key)).map((p) => ({
    id: `p:${p.key}`,
    kind: "preference",
    label: "Chosen preference",
    text: p.label,
  }));
  if (custom.trim()) items.push({ id: "p:custom", kind: "preference", label: "Your instruction", text: custom.trim() });
  return items;
}

/* ------------------------------ sanitizers ------------------------------ */

const str = (v: unknown, max = 800) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strArr = (v: unknown, maxItems = 8, maxLen = 400) =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];

export function knownIds(ids: unknown, evidence: EvidenceItem[]): string[] {
  const set = new Set(evidence.map((e) => e.id));
  return Array.from(new Set(strArr(ids, 12, 40).filter((i) => set.has(i))));
}

/** Concepts must cite at least one real evidence item; uncited concepts are dropped. */
export function sanitizeConcepts(raw: unknown, evidence: EvidenceItem[], round: number): ToolConcept[] {
  if (!Array.isArray(raw)) return [];
  const out: ToolConcept[] = [];
  raw.slice(0, 3).forEach((c, i) => {
    const o = (c ?? {}) as Partial<Record<"name" | "what_it_does" | "why_for_you" | "evidence_ids" | "what_becomes_possible" | "differs_from_generic" | "assumptions", unknown>>;
    const evidence_ids = knownIds(o.evidence_ids, evidence);
    const name = str(o.name, 80);
    const what = str(o.what_it_does);
    if (!name || !what || evidence_ids.length === 0) return;
    out.push({
      id: `r${round}-${i + 1}`,
      name,
      what_it_does: what,
      why_for_you: str(o.why_for_you),
      evidence_ids,
      what_becomes_possible: str(o.what_becomes_possible),
      differs_from_generic: str(o.differs_from_generic),
      assumptions: strArr(o.assumptions, 5, 240),
    });
  });
  return out;
}

export function sanitizeNeeds(raw: unknown, evidence: EvidenceItem[]): InferredNeed[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return raw.slice(0, 6).flatMap((n, i) => {
    const o = (n ?? {}) as Partial<Record<"need" | "evidence_ids", unknown>>;
    const need = str(o.need, 240);
    if (!need) return [];
    const evidence_ids = knownIds(o.evidence_ids, evidence);
    // "stated" only if every cited item is something the person wrote themselves.
    const stated = evidence_ids.length > 0 && evidence_ids.every((id) => byId.get(id)?.kind === "stated");
    return [{ id: `n${i + 1}`, need, evidence_ids, basis: stated ? ("stated" as const) : ("hypothesis" as const) }];
  });
}

/** Fact/hypothesis/preference label for a design decision, derived from its evidence only. */
export function decisionBasis(ids: string[], evidence: EvidenceItem[]): DesignDecision["basis"] {
  const kinds = ids.map((id) => evidence.find((e) => e.id === id)?.kind).filter(Boolean) as EvidenceKind[];
  if (kinds.length === 0 || kinds.includes("hypothesis")) return "hypothesis";
  if (kinds.includes("preference")) return "preference";
  return "stated";
}

export function sanitizeDecisions(raw: unknown, evidence: EvidenceItem[]): DesignDecision[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).flatMap((d, i) => {
    const o = (d ?? {}) as Partial<Record<"because" | "decision" | "benefit" | "evidence_ids", unknown>>;
    const decision = str(o.decision, 400);
    const evidence_ids = knownIds(o.evidence_ids, evidence);
    if (!decision || evidence_ids.length === 0) return [];
    return [
      {
        id: `d${i + 1}`,
        because: str(o.because, 500),
        decision,
        benefit: str(o.benefit, 300),
        evidence_ids,
        basis: decisionBasis(evidence_ids, evidence),
      },
    ];
  });
}

/* ---------------------------- prompt assembly ---------------------------- */

export const BUILDERS: { key: Builder; label: string; framing: string }[] = [
  {
    key: "lovable",
    label: "Lovable",
    framing:
      "Build this as a Lovable web app (React, TypeScript, Tailwind). Start with data stored in the browser (localStorage/IndexedDB); only enable Lovable Cloud if the person later wants their data on more than one device.",
  },
  {
    key: "codex",
    label: "Codex",
    framing:
      "Implement this in a new repository as a small Vite + React + TypeScript web app with no backend. Store data in IndexedDB. Include a README with run instructions and automated tests (Vitest + Testing Library) that cover the acceptance tests below.",
  },
  {
    key: "neutral",
    label: "Any builder",
    framing:
      "Build this as a small, installable web app using any modern stack you prefer. Keep it free to run: no paid APIs, no accounts required, data stored on the person's own device by default.",
  },
];

type PromptParts = Omit<Blueprint, "build_prompt" | "source" | "model" | "generated_at">;

const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

/** One coherent, copy-ready prompt. Accessibility requirements are always included verbatim. */
export function assembleBuildPrompt(b: PromptParts, customInstructions = ""): string {
  const framing = BUILDERS.find((x) => x.key === b.builder)?.framing ?? BUILDERS[2]!.framing;
  const a11y = Array.from(new Set([...accessibilityRequirements(b.preferences, customInstructions), ...b.accessibility]));
  const features = (["must", "should", "could"] as const)
    .map((p) => {
      const fs = b.core_features.filter((f) => f.priority === p);
      return fs.length ? `${p.toUpperCase()} have:\n${fs.map((f, i) => `${i + 1}. ${f.name} — ${f.description}`).join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  const sections = [
    `Build "${b.tool_name}" — a personal tool designed for one specific person.`,
    framing,
    `## Purpose\n${b.purpose}`,
    b.personal_context.length ? `## About the person (shared with their approval)\n${list(b.personal_context.map((d) => d.text))}` : "",
    b.user_requirements.length ? `## How they want to work\n${list(b.user_requirements)}` : "",
    b.design_decisions.length
      ? `## Design decisions to keep\n${list(b.design_decisions.map((d) => `${d.decision}${d.benefit ? ` (so that ${d.benefit.replace(/^so that\s+/i, "")})` : ""}`))}`
      : "",
    `## Core functionality (in priority order)\n${features}`,
    `## Interface\nLayout: ${b.interface.layout}\nNavigation: ${b.interface.navigation}\nScreens:\n${list(b.interface.screens.map((s) => `${s.name}: ${s.purpose}`))}\nKey interactions:\n${list(b.interface.interactions)}\nResponsive behaviour: ${b.interface.responsive}`,
    `## Accessibility requirements (must implement)\n${list(a11y)}`,
    `## Data and privacy\nStores:\n${list(b.data_privacy.stores)}\nKeep private:\n${list(b.data_privacy.keep_private)}\nEditing and deleting: ${b.data_privacy.edit_delete}`,
    `## Technical approach\n${list(b.architecture)}\nDo not add paid services, external accounts or integrations that are not listed here.`,
    `## Acceptance tests (the app is done when all pass)\n${list(b.acceptance_tests)}`,
    `## First-use validation\n${b.first_use_validation.experiment}\nMeasure: ${b.first_use_validation.measures.join("; ")}\nDuration: ${b.first_use_validation.duration}\nAdd a simple in-app log so the person can record these measurements themselves.`,
  ];
  return sections.filter(Boolean).join("\n\n");
}

export function blueprintMarkdown(b: Blueprint, rationale: Rationale | null, evidence: EvidenceItem[], approved: ApprovedDetail[] | null): string {
  const allowed = new Set((approved ?? []).map((d) => d.id));
  const ev = (ids: string[]) =>
    ids
      .filter((id) => allowed.has(id) || id.startsWith("p:"))
      .map((id) => approved?.find((d) => d.id === id)?.text ?? evidence.find((e) => e.id === id)?.text)
      .filter(Boolean)
      .join("; ");
  const lines = [
    `# ${b.tool_name}`,
    `*Made for you by Latentora · ${b.source === "meta_live" ? `Muse Spark (${b.model ?? "Meta"})` : "Sample data — not live Meta output"} · ${b.generated_at.slice(0, 10)}*`,
    `## Personal purpose\n${b.purpose}`,
    `## Intended personal benefit\n${b.intended_benefit}`,
    rationale
      ? `## Why I designed this for you\n${rationale.decisions
          .map((d) => {
            const e = ev(d.evidence_ids);
            return `- **${d.decision}**${d.benefit ? ` — ${d.benefit}` : ""}${e ? `\n  - Based on (${d.basis === "hypothesis" ? "AI hypothesis" : d.basis === "preference" ? "your preference" : "what you told us"}): ${e}` : ""}`;
          })
          .join("\n")}`
      : "",
    `## Accessibility preferences\n${b.preferences.length ? list(b.preferences.map(preferenceLabel)) : "- None selected"}`,
    `## Core features\n${list(b.core_features.map((f) => `[${f.priority}] ${f.name} — ${f.description}`))}`,
    `## Copy-ready build prompt (${BUILDERS.find((x) => x.key === b.builder)?.label})\n\n\`\`\`text\n${b.build_prompt}\n\`\`\``,
    `---\nA blueprint is a plan, not proof. Whether this tool helps is something only you can find out by trying it.`,
  ];
  return lines.filter(Boolean).join("\n\n");
}
