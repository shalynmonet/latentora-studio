// Judge demo: two FICTIONAL people with the same ambition. Hand-written sample profiles;
// their outputs are either run live through the real pipeline or replayed from a
// recorded run (clearly labelled, never presented as live).
import type { Customization, EvidenceItem, PreferenceKey } from "./made-for-me";

export const DEMO_AMBITION = "I want to finish more creative projects.";

export interface DemoProfile {
  key: "A" | "B";
  name: string;
  portrait: string;
  working_style: string;
  evidence: EvidenceItem[];
  preferences: PreferenceKey[];
  custom_instructions: string;
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    key: "A",
    name: "Iris (fictional)",
    portrait: "Works across illustration, ceramics and photography; thinks in moodboards.",
    working_style: "I like to see everything at once and move ideas around. Rigid timelines make me drop projects.",
    preferences: ["visual_first", "flexible_pacing"],
    custom_instructions: "",
    evidence: [
      { id: "goal", kind: "stated", label: "Ambition", text: DEMO_AMBITION },
      { id: "style", kind: "stated", label: "How they like to work", text: "I like to see everything at once and move ideas around. Rigid timelines make me drop projects." },
      { id: "s1", kind: "stated", label: "Project", text: "Illustrated a 24-page zine by pinning sketches to a wall and rearranging them until the story worked." },
      { id: "s2", kind: "stated", label: "Experience", text: "Juggles ceramics, photography and illustration side projects; often starts a new one when two ideas connect." },
      { id: "s3", kind: "stated", label: "Frustration", text: "Linear task apps hide how my projects relate, so I forget half-finished pieces that could feed each other." },
      { id: "c1", kind: "demonstrated", label: "Capability (demonstrated)", text: "Visual storytelling — sequenced a full zine spatially." },
      { id: "c2", kind: "hypothesis", label: "Capability (hypothesis)", text: "Cross-disciplinary synthesis — may finish more when projects are linked rather than isolated." },
    ],
  },
  {
    key: "B",
    name: "Dev (fictional)",
    portrait: "Writes songs and short audio stories; ideas arrive while walking.",
    working_style: "I record voice memos all day but never go back to them. I need to be told the one next thing to do.",
    preferences: ["voice_first", "step_by_step", "low_distraction", "minimal_typing"],
    custom_instructions: "",
    evidence: [
      { id: "goal", kind: "stated", label: "Ambition", text: DEMO_AMBITION },
      { id: "style", kind: "stated", label: "How they like to work", text: "I record voice memos all day but never go back to them. I need to be told the one next thing to do." },
      { id: "s1", kind: "stated", label: "Project", text: "Finished a 6-episode audio story after a friend texted one small task each evening." },
      { id: "s2", kind: "stated", label: "Experience", text: "Has 300+ unsorted voice memos with melodies and lines captured on walks." },
      { id: "s3", kind: "stated", label: "Frustration", text: "Busy screens with lots of options make me freeze and choose nothing." },
      { id: "c1", kind: "demonstrated", label: "Capability (demonstrated)", text: "Follow-through with external prompting — completed a series when given one daily step." },
      { id: "c2", kind: "hypothesis", label: "Capability (hypothesis)", text: "Melodic recall — memos suggest strong idea generation that stalls at sorting." },
    ],
  },
];

export const demoCustomization = (p: DemoProfile, outcome: string): Customization => ({
  outcome,
  assumptions: [],
  preferences: p.preferences,
  custom_instructions: p.custom_instructions,
  builder: "lovable",
});
