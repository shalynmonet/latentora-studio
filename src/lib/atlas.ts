// Builds the Capability Atlas from analysis + Proof Lab experiments. Deterministic.
import { TESTED_CAPABILITIES } from "./scoring";
import type { Analysis, CapabilityTestResult, Experiment, Opportunity } from "./types";

export type AtlasStatus = "demonstrated" | "hypothesized" | "tested";

export interface AtlasNode {
  id: string;
  name: string;
  category: string;
  status: AtlasStatus;
  /** Status before Proof Lab results were applied. */
  originalStatus: "demonstrated" | "hypothesized" | null;
  evidence: string[];
  test: (CapabilityTestResult & { experimentId: string; date: string }) | null;
}

export interface AtlasEdge {
  from: string;
  to: string;
  insight: string;
}

const KEYWORDS: Record<string, string[]> = {
  [TESTED_CAPABILITIES.structural]: ["structur", "engineering"],
  [TESTED_CAPABILITIES.efficiency]: ["efficien", "resource", "waste"],
  [TESTED_CAPABILITIES.iteration]: ["iterat", "prototyp", "experiment"],
};

const key = (s: string) => s.trim().toLowerCase();

export function matchesTestedCapability(capName: string, tested: string): boolean {
  const k = key(capName);
  if (k === key(tested)) return true;
  return (KEYWORDS[tested] ?? []).some((w) => k.includes(w));
}

export function buildAtlas(analysis: Analysis | null, experiments: Experiment[]) {
  const nodes: AtlasNode[] = [];
  const edges: AtlasEdge[] = [];

  for (const c of analysis?.result.capabilities ?? []) {
    nodes.push({
      id: key(c.name),
      name: c.name,
      category: c.category,
      status: c.status,
      originalStatus: c.status,
      evidence: c.evidence.map((e) => `${e.story_title}: ${e.detail}`),
      test: null,
    });
  }

  // Most recent experiment first; first match wins.
  const sorted = [...experiments].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const exp of sorted) {
    for (const t of exp.score.capabilities) {
      if (t.verdict === "not_yet_supported") continue;
      const existing = nodes.filter((n) => matchesTestedCapability(n.name, t.capability));
      const testInfo = { ...t, experimentId: exp.id, date: exp.created_at };
      if (existing.length) {
        for (const n of existing) {
          if (!n.test) {
            n.test = testInfo;
            n.status = "tested";
          }
        }
      } else if (!nodes.some((n) => n.id === key(t.capability))) {
        nodes.push({
          id: key(t.capability),
          name: t.capability,
          category: "craft",
          status: "tested",
          originalStatus: null,
          evidence: [],
          test: testInfo,
        });
      }
    }
  }

  for (const conn of analysis?.result.connections ?? []) {
    const [a, b] = conn.between;
    if (a && b && nodes.some((n) => n.id === key(a)) && nodes.some((n) => n.id === key(b))) {
      edges.push({ from: key(a), to: key(b), insight: conn.insight });
    }
  }

  return { nodes, edges };
}

/** Which matched opportunities rely on capabilities that now have test evidence. */
export function opportunitiesAffected(nodes: AtlasNode[], opportunities: Opportunity[]) {
  const tested = nodes.filter((n) => n.status === "tested");
  return opportunities
    .filter((o) => o.match)
    .map((o) => {
      const backed = (o.match?.abilities_used ?? []).filter((a) =>
        tested.some((t) => key(t.name) === key(a) || (t.test && matchesTestedCapability(a, t.test.capability))),
      );
      return { opportunity: o, backed };
    })
    .filter((x) => x.backed.length > 0);
}
