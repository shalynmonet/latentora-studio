// Deterministic scoring for the Paper Structure Challenge.
// No AI involved: every verdict comes from the measurements the user entered.
import type {
  CapabilityTestResult,
  CriterionResult,
  CriterionStatus,
  PaperChallengeInputs,
  PaperChallengeScore,
} from "./types";

export const PAPER_RULES = {
  maxSheets: 10,
  maxTapeCm: 50,
  heightTargetCm: 30,
  heightPartialCm: 20,
  holdTargetSeconds: 30,
  /** Approximate mass of one A4 / Letter 80 gsm sheet. */
  sheetMassGrams: 5,
  efficiencyTarget: 20,
  efficiencyPartial: 5,
  iterationTarget: 2,
} as const;

export const TESTED_CAPABILITIES = {
  structural: "Structural reasoning",
  efficiency: "Resource efficiency",
  iteration: "Iterative prototyping",
} as const;

function n(v: number) {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function scorePaperChallenge(raw: PaperChallengeInputs): PaperChallengeScore {
  const sheets = n(raw.sheets_used);
  const tape = n(raw.tape_cm);
  const height = n(raw.height_cm);
  const load = n(raw.load_g);
  const hold = n(raw.hold_seconds);
  const iterations = n(raw.iterations);
  const R = PAPER_RULES;

  const withinConstraints = sheets > 0 && sheets <= R.maxSheets && tape <= R.maxTapeCm;
  const constraints: CriterionResult = {
    id: "constraints",
    label: "Stayed within materials",
    status: withinConstraints ? "met" : "not_met",
    measured: `${sheets} sheets, ${tape} cm tape`,
    target: `≤ ${R.maxSheets} sheets and ≤ ${R.maxTapeCm} cm tape`,
  };

  const heightStatus: CriterionStatus =
    height >= R.heightTargetCm ? "met" : height >= R.heightPartialCm ? "partial" : "not_met";
  const heightC: CriterionResult = {
    id: "height",
    label: "Reached target height",
    status: heightStatus,
    measured: `${height} cm`,
    target: `≥ ${R.heightTargetCm} cm (partial ≥ ${R.heightPartialCm} cm)`,
  };

  const holdStatus: CriterionStatus =
    load > 0 && hold >= R.holdTargetSeconds ? "met" : load > 0 && hold > 0 ? "partial" : "not_met";
  const holdC: CriterionResult = {
    id: "hold",
    label: "Held a load",
    status: holdStatus,
    measured: `${load} g for ${hold} s`,
    target: `Any load for ≥ ${R.holdTargetSeconds} s`,
  };

  const paperMass = sheets * R.sheetMassGrams;
  const ratio = paperMass > 0 && load > 0 ? Math.round((load / paperMass) * 10) / 10 : null;
  const effStatus: CriterionStatus =
    ratio === null || holdStatus === "not_met"
      ? "not_met"
      : ratio >= R.efficiencyTarget
        ? "met"
        : ratio >= R.efficiencyPartial
          ? "partial"
          : "not_met";
  const effC: CriterionResult = {
    id: "efficiency",
    label: "Load-to-paper ratio",
    status: effStatus,
    measured: ratio === null ? "—" : `${ratio}× its paper mass`,
    target: `≥ ${R.efficiencyTarget}× (partial ≥ ${R.efficiencyPartial}×)`,
  };

  const iterStatus: CriterionStatus =
    iterations >= R.iterationTarget ? "met" : iterations >= 1 ? "partial" : "not_met";
  const iterC: CriterionResult = {
    id: "iteration",
    label: "Prototyped and revised",
    status: iterStatus,
    measured: `${iterations} prototype${iterations === 1 ? "" : "s"}`,
    target: `≥ ${R.iterationTarget} prototypes`,
  };

  const criteria = [constraints, heightC, holdC, effC, iterC];

  const verdict = (statuses: CriterionStatus[]): CapabilityTestResult["verdict"] => {
    if (!withinConstraints) return "not_yet_supported";
    if (statuses.every((s) => s === "met")) return "supported";
    if (statuses.some((s) => s !== "not_met")) return "partially_supported";
    return "not_yet_supported";
  };

  const capabilities: CapabilityTestResult[] = [
    {
      capability: TESTED_CAPABILITIES.structural,
      verdict: verdict([heightStatus, holdStatus]),
      criteria: ["height", "hold"],
    },
    {
      capability: TESTED_CAPABILITIES.efficiency,
      verdict: verdict([constraints.status, effStatus]),
      criteria: ["constraints", "efficiency"],
    },
    {
      capability: TESTED_CAPABILITIES.iteration,
      verdict: verdict([iterStatus]),
      criteria: ["iteration"],
    },
  ];

  return {
    criteria,
    capabilities,
    efficiency_ratio: ratio,
    met_count: criteria.filter((c) => c.status === "met").length,
  };
}
