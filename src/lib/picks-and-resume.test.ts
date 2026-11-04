import { describe, expect, it } from "vitest";
import { PICKS_COUNT, pickQueries } from "./listings";
import { dropRejected, resumeForAnalysis } from "./resume-rules";
import type { ResumeAnalysisResult } from "./types";

describe("Explore pre-populated picks", () => {
  it("pre-populates 5 listings", () => {
    expect(PICKS_COUNT).toBe(5);
  });

  it("searches the person's transferable contexts first, then demonstrated abilities", () => {
    const q = pickQueries({
      transferable_skills: [{ to_contexts: ["Operations coordinator role", "Operations coordinator"] }],
      capabilities: [
        { name: "Hunch thing", status: "hypothesized" },
        { name: "Workshop facilitation", status: "demonstrated" },
      ],
    });
    expect(q).toEqual(["operations coordinator", "workshop facilitation", "hunch thing"]);
  });

  it("returns nothing without a capability map", () => {
    expect(pickQueries(null)).toEqual([]);
  });
});

const resume = (review: Record<string, { decision: "confirmed" | "rejected" }>) => ({
  review,
  result: {
    passages: [{ id: "p1", quote: "Led a team of 6 volunteers", verified: true }],
    profile: { roles: [{ title: "Coordinator", organization: "Food Bank", period: "2021–2023", responsibilities: [], passage_ids: ["p1"] }], education: [], projects: [], accomplishments: [], skills_named: [] },
    findings: [
      { id: "f1", name: "Team leadership", category: "people", classification: "direct", named_in_resume: false, explanation: "", passage_ids: ["p1"] },
      { id: "f2", name: "Budgeting", category: "analytical", classification: "insufficient", named_in_resume: true, explanation: "", passage_ids: [] },
    ],
    beyond: { headline: "", insight: "", connections: [] },
  } as ResumeAnalysisResult,
});

describe("résumé alone unlocks the capability analysis", () => {
  it("gives the analysis the quoted passages and roles", () => {
    const r = resumeForAnalysis(resume({}));
    expect(r?.text).toContain('"Led a team of 6 volunteers"');
    expect(r?.text).toContain("Coordinator at Food Bank");
  });

  it("is unavailable without a résumé", () => {
    expect(resumeForAnalysis(null)).toBeNull();
  });

  it("keeps findings the person rejected out of the analysis", () => {
    const r = resumeForAnalysis(resume({ f2: { decision: "rejected" } }))!;
    expect(r.rejected).toEqual(["Budgeting"]);
    expect(dropRejected([{ name: "budgeting " }, { name: "Team leadership" }], r.rejected).map((c) => c.name)).toEqual(["Team leadership"]);
  });
});
