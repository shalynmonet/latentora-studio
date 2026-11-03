import { describe, expect, it } from "vitest";
import { scorePaperChallenge } from "./scoring";
import { parseSamBoxes, describeSegmentation } from "./sam-parse";
import { buildAtlas } from "./atlas";
import type { Experiment } from "./types";

const base = { sheets_used: 8, tape_cm: 40, height_cm: 35, load_g: 900, hold_seconds: 45, iterations: 3, build_minutes: 25, reflection: "" };

describe("Paper Structure Challenge scoring", () => {
  it("meets every criterion for a strong, in-bounds attempt", () => {
    const s = scorePaperChallenge(base);
    expect(s.met_count).toBe(5);
    expect(s.efficiency_ratio).toBe(22.5); // 900g / (8 sheets * 5g)
    expect(s.capabilities.every((c) => c.verdict === "supported")).toBe(true);
  });

  it("fails constraints above 10 sheets and supports no capability", () => {
    const s = scorePaperChallenge({ ...base, sheets_used: 11 });
    expect(s.criteria.find((c) => c.id === "constraints")?.status).toBe("not_met");
    expect(s.capabilities.every((c) => c.verdict === "not_yet_supported")).toBe(true);
  });

  it("fails constraints above 50 cm of tape", () => {
    const s = scorePaperChallenge({ ...base, tape_cm: 51 });
    expect(s.criteria.find((c) => c.id === "constraints")?.status).toBe("not_met");
  });

  it("gives partial height between 20 and 30 cm", () => {
    expect(scorePaperChallenge({ ...base, height_cm: 25 }).criteria.find((c) => c.id === "height")?.status).toBe("partial");
    expect(scorePaperChallenge({ ...base, height_cm: 19 }).criteria.find((c) => c.id === "height")?.status).toBe("not_met");
  });

  it("requires a 30 second hold for a full hold", () => {
    expect(scorePaperChallenge({ ...base, hold_seconds: 29 }).criteria.find((c) => c.id === "hold")?.status).toBe("partial");
    expect(scorePaperChallenge({ ...base, load_g: 0 }).criteria.find((c) => c.id === "hold")?.status).toBe("not_met");
  });

  it("needs at least two prototypes for iteration", () => {
    expect(scorePaperChallenge({ ...base, iterations: 1 }).capabilities.find((c) => c.capability === "Iterative prototyping")?.verdict).toBe("partially_supported");
  });
});

describe("SAM output parsing", () => {
  const text =
    "<0f>0<|box;x1=160;y1=82;x2=239;y2=279;w=400;h=300;c=0.85|><|mask;x=0;y=0;c=0.85;data=198,80,~abc|>,3<|box;x1=10;y1=10;x2=20;y2=20;w=400;h=300|><|mask;x=0;y=0;data=1,1,~x|>";
  it("reads every box with ids and optional confidence", () => {
    const boxes = parseSamBoxes(text);
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ id: 0, x1: 160, y2: 279, w: 400, confidence: 0.85 });
    expect(boxes[1]).toMatchObject({ id: 3, confidence: null });
  });
  it("treats empty output as zero matches", () => {
    expect(parseSamBoxes("")).toEqual([]);
    expect(describeSegmentation([], [], "paper tower", null)[0]).toContain("No region");
  });
});

describe("Capability Atlas", () => {
  it("marks a hypothesised capability as tested after a supported challenge", () => {
    const exp = { id: "e1", created_at: "2026-01-01", score: scorePaperChallenge(base) } as unknown as Experiment;
    const { nodes } = buildAtlas(
      {
        id: "a",
        source: "meta_live",
        model: null,
        created_at: "",
        result: {
          summary: "",
          capabilities: [{ name: "Structural reasoning", category: "craft", status: "hypothesized", evidence: [], rationale: "" }],
          transferable_skills: [],
          connections: [],
          needs_validation: [],
        },
      },
      [exp],
    );
    const n = nodes.find((x) => x.name === "Structural reasoning");
    expect(n?.status).toBe("tested");
    expect(n?.originalStatus).toBe("hypothesized");
  });
});

describe("Atlas keyword linking", () => {
  it("does not treat unrelated 'building' stories as structural testing", async () => {
    const { matchesTestedCapability } = await import("./atlas");
    expect(matchesTestedCapability("Community Library Building", "Structural reasoning")).toBe(false);
    expect(matchesTestedCapability("Paper engineering", "Structural reasoning")).toBe(true);
  });
});
