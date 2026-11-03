// Designed challenges: Muse Spark proposes the task and its targets, but the spec is
// sanitised here and every verdict comes from a fixed numeric comparison. No AI in scoring.
import type {
  CapabilityTestResult,
  ChallengeMeasure,
  ChallengeSpec,
  CriterionResult,
  CriterionStatus,
  CustomChallengeInputs,
  PaperChallengeScore,
} from "./types";

export const CHALLENGE_LIMITS = {
  minMeasures: 3,
  maxMeasures: 5,
  maxDurationMinutes: 90,
  maxSteps: 8,
  maxMaterials: 8,
} as const;

const clip = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "measure";

type Loose = { [k: string]: unknown } & Partial<Record<
  "measures" | "label" | "target" | "partial" | "direction" | "unit" | "how_to_measure" | "steps" | "title" | "duration_minutes" | "photo_subject" | "why" | "materials" | "safety_note",
  unknown
>>;

/** Validates and normalises a model-proposed spec. Returns null if it can't be scored fairly. */
export function sanitizeSpec(raw: unknown, capability: string): ChallengeSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Loose;
  const seen = new Set<string>();
  const measures: ChallengeMeasure[] = [];
  for (const m of Array.isArray(r.measures) ? r.measures : []) {
    if (!m || typeof m !== "object") continue;
    const x = m as Loose;
    const label = clip(x.label, 80);
    const target = Number(x.target);
    let partial = Number(x.partial);
    const direction = x.direction === "at_most" ? "at_most" : x.direction === "at_least" ? "at_least" : null;
    if (!label || !direction || !Number.isFinite(target) || target <= 0 || target > 100000) continue;
    // Partial must sit on the "easier" side of the target; otherwise derive it.
    if (!Number.isFinite(partial) || partial <= 0 || (direction === "at_least" ? partial >= target : partial <= target)) {
      partial = direction === "at_least" ? target / 2 : target * 1.5;
    }
    let id = slug(label);
    while (seen.has(id)) id += "_x";
    seen.add(id);
    measures.push({
      id,
      label,
      unit: clip(x.unit, 20) || "count",
      direction,
      target: round(target),
      partial: round(partial),
      how_to_measure: clip(x.how_to_measure, 200),
    });
    if (measures.length === CHALLENGE_LIMITS.maxMeasures) break;
  }
  if (measures.length < CHALLENGE_LIMITS.minMeasures) return null;

  const list = (v: unknown, n: number, len: number) =>
    (Array.isArray(v) ? v : []).map((s) => clip(s, len)).filter(Boolean).slice(0, n);
  const steps = list(r.steps, CHALLENGE_LIMITS.maxSteps, 240);
  const title = clip(r.title, 80);
  if (!title || steps.length === 0) return null;
  const duration = Math.round(Number(r.duration_minutes));
  const subject = clip(r.photo_subject, 50);

  return {
    title,
    capability: clip(capability, 120),
    why: clip(r.why, 300),
    duration_minutes: Number.isFinite(duration) && duration > 0 ? Math.min(duration, CHALLENGE_LIMITS.maxDurationMinutes) : 30,
    materials: list(r.materials, CHALLENGE_LIMITS.maxMaterials, 100),
    steps,
    measures,
    photo_subject: subject.length >= 2 ? subject : null,
    safety_note: clip(r.safety_note, 200),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function measureStatus(m: ChallengeMeasure, value: number | undefined): CriterionStatus {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return "not_met";
  if (m.direction === "at_least") return v >= m.target ? "met" : v >= m.partial ? "partial" : "not_met";
  return v <= m.target ? "met" : v <= m.partial ? "partial" : "not_met";
}

export function scoreCustomChallenge(spec: ChallengeSpec, inputs: CustomChallengeInputs): PaperChallengeScore {
  const criteria: CriterionResult[] = spec.measures.map((m) => {
    const raw = inputs.values[m.id];
    const recorded = raw !== undefined && raw !== null && Number.isFinite(Number(raw));
    const status = recorded ? measureStatus(m, Number(raw)) : "not_met";
    const sign = m.direction === "at_least" ? "≥" : "≤";
    return {
      id: m.id,
      label: m.label,
      status,
      measured: recorded ? `${Number(raw)} ${m.unit}` : "—",
      target: `${sign} ${m.target} ${m.unit} (partial ${sign} ${m.partial})`,
    };
  });
  const statuses = criteria.map((c) => c.status);
  const verdict: CapabilityTestResult["verdict"] = statuses.every((s) => s === "met")
    ? "supported"
    : statuses.some((s) => s !== "not_met")
      ? "partially_supported"
      : "not_yet_supported";
  return {
    criteria,
    capabilities: [{ capability: spec.capability, verdict, criteria: criteria.map((c) => c.id) }],
    efficiency_ratio: null,
    met_count: statuses.filter((s) => s === "met").length,
  };
}
