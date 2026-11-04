import { describe, expect, it } from "vitest";
import { approvedCapabilities, mergeResumeIntoAnalysis, quoteInDocument, sanitizeResumeAnalysis } from "./resume-rules";
import type { Analysis } from "./types";

const DOC = `Maya Ortiz
Operations Coordinator, Riverside Food Bank (2019–2023)
• Rebuilt the volunteer rota so 120 volunteers could swap shifts without calling the office.
• Cut weekly food waste by 30% by redesigning intake checks.
B.A. Sociology, Lakeview College`;

const raw = {
  passages: [
    { id: "p1", quote: "Rebuilt the volunteer rota so 120 volunteers could swap shifts without calling the office." },
    { id: "p2", quote: "Cut weekly food waste by 30% by redesigning intake checks." },
    { id: "p3", quote: "Managed a $2M budget across five sites." }, // not in the document
    { id: "p4", quote: "B.A. Sociology, Lakeview College" },
  ],
  profile: {
    roles: [{ title: "Operations Coordinator", organization: "Riverside Food Bank", period: "2019–2023", responsibilities: ["Volunteer rota"], passage_ids: ["p1", "p2"] }],
    education: [{ credential: "B.A. Sociology", institution: "Lakeview College", period: "", passage_ids: ["p4"] }],
    projects: [{ name: "Budget overhaul", detail: "", passage_ids: ["p3"] }],
    accomplishments: [{ text: "Cut food waste 30%", passage_ids: ["p2"] }],
    skills_named: [],
  },
  findings: [
    { name: "Process Redesign", category: "systems", classification: "direct", named_in_resume: false, explanation: "Redesigned intake checks.", passage_ids: ["p2"] },
    { name: "Budget Management", category: "analytical", classification: "direct", named_in_resume: true, explanation: "Managed budget.", passage_ids: ["p3"] },
    { name: "Self-service Systems Design", category: "systems", classification: "hypothesis", named_in_resume: false, explanation: "Rota let volunteers self-serve.", passage_ids: ["p1"] },
    { name: "Public Speaking", category: "people", classification: "hypothesis", named_in_resume: false, explanation: "Maybe.", passage_ids: [] },
    { name: "Religious Background", category: "people", classification: "hypothesis", named_in_resume: false, explanation: "x", passage_ids: ["p1"] },
  ],
  beyond: { headline: "h", insight: "i", connections: [{ between: ["Process Redesign", "Self-service Systems Design"], insight: "c" }, { between: ["Process Redesign", "Invented"], insight: "x" }] },
};

describe("résumé analysis sanitisation", () => {
  const r = sanitizeResumeAnalysis(raw, DOC);

  it("drops quotes that are not in the document, and entries that only cited them", () => {
    expect(r.passages.map((p) => p.id)).toEqual(["p1", "p2", "p4"]);
    expect(r.profile.projects).toHaveLength(0);
    expect(quoteInDocument("cut weekly food waste by 30% by redesigning intake checks", DOC)).toBe(true);
  });

  it("downgrades a 'direct' finding whose only evidence was fabricated", () => {
    expect(r.findings.find((f) => f.name === "Budget Management")?.classification).toBe("insufficient");
    // direct with no passages → hypothesis → (no passages) insufficient
  });

  it("keeps a direct finding with a verified quote as direct", () => {
    expect(r.findings.find((f) => f.name === "Process Redesign")?.classification).toBe("direct");
  });

  it("marks a hypothesis with no supporting passage as insufficient evidence", () => {
    expect(r.findings.find((f) => f.name === "Public Speaking")?.classification).toBe("insufficient");
  });

  it("never keeps protected characteristics", () => {
    expect(r.findings.some((f) => /religio/i.test(f.name))).toBe(false);
  });

  it("only keeps connections between surviving findings", () => {
    expect(r.beyond.connections).toHaveLength(1);
  });
});

describe("approval and Atlas merge", () => {
  const r = sanitizeResumeAnalysis(raw, DOC);
  const id = (n: string) => r.findings.find((f) => f.name === n)!.id;

  it("rejected and undecided findings never reach the Atlas", () => {
    const caps = approvedCapabilities(r, { [id("Process Redesign")]: { decision: "rejected" } });
    expect(caps).toHaveLength(0);
  });

  it("confirming a hypothesis keeps it a hypothesis; edits rename it", () => {
    const caps = approvedCapabilities(r, {
      [id("Self-service Systems Design")]: { decision: "confirmed", name: "Self-serve System Design" },
      [id("Process Redesign")]: { decision: "confirmed" },
    });
    expect(caps.find((c) => c.name === "Self-serve System Design")?.status).toBe("hypothesized");
    expect(caps.find((c) => c.name === "Process Redesign")?.status).toBe("demonstrated");
    expect(caps[0]!.evidence[0]!.detail).toContain("redesigning intake checks");
  });

  const story: Analysis = {
    id: "a1",
    source: "meta_live",
    model: "m",
    created_at: "2026-01-01",
    result: {
      summary: "s",
      capabilities: [
        { name: "Process redesign", category: "systems", status: "hypothesized", evidence: [], rationale: "r" },
        { name: "Community Facilitation", category: "people", status: "demonstrated", evidence: [{ story_title: "Repair café", detail: "ran it" }], rationale: "r" },
      ],
      transferable_skills: [],
      connections: [],
      needs_validation: [],
    },
  };

  it("merges same-named capabilities without duplicating, upgrading only to the stronger evidence", () => {
    const caps = approvedCapabilities(r, { [id("Process Redesign")]: { decision: "confirmed" } });
    const merged = mergeResumeIntoAnalysis(story, caps, null)!;
    expect(merged.result.capabilities).toHaveLength(2);
    const pr = merged.result.capabilities.find((c) => c.name === "Process redesign")!;
    expect(pr.status).toBe("demonstrated");
    expect(pr.origin).toBe("both");
  });

  it("never downgrades or removes existing story evidence", () => {
    const weak = [{ name: "community facilitation", category: "people" as const, status: "hypothesized" as const, evidence: [{ story_title: "Your résumé", detail: "q" }], rationale: "" }];
    const merged = mergeResumeIntoAnalysis(story, weak, null)!;
    const cf = merged.result.capabilities.find((c) => c.name === "Community Facilitation")!;
    expect(cf.status).toBe("demonstrated");
    expect(cf.evidence.map((e) => e.story_title)).toEqual(["Repair café", "Your résumé"]);
    expect(story.result.capabilities[1]!.evidence).toHaveLength(1); // input untouched
  });

  it("works with a résumé alone, before any stories are analysed", () => {
    const caps = approvedCapabilities(r, { [id("Process Redesign")]: { decision: "confirmed" } });
    const merged = mergeResumeIntoAnalysis(null, caps, { source: "meta_live", model: "x", created_at: "2026-01-01" });
    expect(merged?.result.capabilities.map((c) => c.name)).toEqual(["Process Redesign"]);
  });
});
