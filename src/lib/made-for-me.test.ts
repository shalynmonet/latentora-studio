import { describe, expect, it } from "vitest";
import {
  accessibilityRequirements,
  assembleBuildPrompt,
  blueprintMarkdown,
  decisionBasis,
  sanitizeConcepts,
  sanitizeNeeds,
  type Blueprint,
  type EvidenceItem,
} from "./made-for-me";

const evidence: EvidenceItem[] = [
  { id: "goal", kind: "stated", label: "Goal", text: "Finish more creative projects" },
  { id: "s1", kind: "stated", label: "Story", text: "Night-shift baker in Leeds" },
  { id: "c1", kind: "hypothesis", label: "Atlas", text: "Systems thinking" },
  { id: "p:voice_first", kind: "preference", label: "Pref", text: "Voice-first interaction" },
];

const base: Omit<Blueprint, "build_prompt" | "source" | "model" | "generated_at"> = {
  tool_name: "Memo Mill",
  purpose: "Turn voice memos into one next step.",
  user_requirements: [],
  core_features: [{ name: "Capture", description: "Record", priority: "must" }],
  interface: { layout: "Single column", navigation: "None", screens: [{ name: "Home", purpose: "Capture" }], interactions: [], responsive: "Phone first" },
  accessibility: [],
  data_privacy: { stores: ["memos"], keep_private: ["audio"], edit_delete: "Delete any memo" },
  architecture: ["On-device storage"],
  acceptance_tests: ["Recording saves"],
  first_use_validation: { experiment: "Two weeks", measures: ["projects finished"], duration: "2 weeks" },
  intended_benefit: "Finish more",
  builder: "lovable",
  preferences: [],
  design_decisions: [],
  personal_context: [],
};

describe("Made for Me rules", () => {
  it("drops concepts that cite no real evidence and strips unknown ids", () => {
    const out = sanitizeConcepts(
      [
        { name: "A", what_it_does: "x", evidence_ids: ["s1", "made-up"] },
        { name: "B", what_it_does: "y", evidence_ids: ["nope"] },
      ],
      evidence,
      1,
    );
    expect(out.map((c) => c.name)).toEqual(["A"]);
    expect(out[0]?.evidence_ids).toEqual(["s1"]);
  });

  it("labels a need as stated only when every cited item is the person's own words", () => {
    const [a, b] = sanitizeNeeds(
      [
        { need: "n1", evidence_ids: ["goal", "s1"] },
        { need: "n2", evidence_ids: ["goal", "c1"] },
      ],
      evidence,
    );
    expect(a?.basis).toBe("stated");
    expect(b?.basis).toBe("hypothesis");
  });

  it("derives decision basis from evidence kinds", () => {
    expect(decisionBasis(["goal"], evidence)).toBe("stated");
    expect(decisionBasis(["goal", "p:voice_first"], evidence)).toBe("preference");
    expect(decisionBasis(["c1", "p:voice_first"], evidence)).toBe("hypothesis");
  });

  it("selected accessibility preferences change the build prompt", () => {
    const without = assembleBuildPrompt(base);
    const withVoice = assembleBuildPrompt({ ...base, preferences: ["voice_first", "step_by_step"] });
    expect(without).not.toContain("Web Speech API");
    expect(withVoice).toContain("Web Speech API");
    expect(withVoice).toContain("Step X of Y");
    expect(accessibilityRequirements([]).length).toBe(1);
  });

  it("only includes personal details the person approved", () => {
    const prompt = assembleBuildPrompt({ ...base, personal_context: [{ id: "goal", text: "Finish more creative projects" }] });
    expect(prompt).toContain("Finish more creative projects");
    expect(prompt).not.toContain("Leeds");
  });

  it("uses builder-specific framing", () => {
    expect(assembleBuildPrompt({ ...base, builder: "codex" })).toContain("Vitest");
    expect(assembleBuildPrompt({ ...base, builder: "lovable" })).toContain("Lovable web app");
  });

  it("export omits evidence that was not approved", () => {
    const bp: Blueprint = { ...base, build_prompt: "P", source: "meta_live", model: "m", generated_at: "2026-11-04T00:00:00Z" };
    const md = blueprintMarkdown(
      bp,
      { intro: "", source: "meta_live", model: "m", decisions: [{ id: "d1", because: "", decision: "Voice capture", benefit: "", evidence_ids: ["s1", "goal"], basis: "stated" }] },
      evidence,
      [{ id: "goal", text: "Finish more creative projects" }],
    );
    expect(md).toContain("Finish more creative projects");
    expect(md).not.toContain("Leeds");
  });
});
