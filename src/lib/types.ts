// Shared, client-safe types for Latentora.

/** Where a piece of AI output came from. Always shown to the user. */
export type ResultSource = "meta_live" | "demo_sample" | "offline_heuristic";

export type StoryKind = "project" | "experience" | "interest" | "accomplishment";

export interface Story {
  id: string;
  kind: StoryKind;
  title: string;
  description: string;
  created_at: string;
}

export type CapabilityCategory =
  | "craft"
  | "systems"
  | "people"
  | "creative"
  | "analytical"
  | "resilience";

export interface Capability {
  name: string;
  category: CapabilityCategory;
  /** demonstrated = directly described in the user's stories; hypothesized = AI inference. */
  status: "demonstrated" | "hypothesized";
  evidence: { story_title: string; detail: string }[];
  rationale: string;
}

export interface AnalysisResult {
  summary: string;
  capabilities: Capability[];
  transferable_skills: { name: string; from_context: string; to_contexts: string[]; why: string }[];
  connections: { between: string[]; insight: string }[];
  needs_validation: { capability: string; what_would_prove_it: string }[];
}

export interface Analysis {
  id: string;
  source: ResultSource;
  model: string | null;
  result: AnalysisResult;
  created_at: string;
}

export type FitLevel = "strong" | "promising" | "stretch" | "weak";

export interface OpportunityMatch {
  fit: FitLevel;
  abilities_used: string[];
  evidence: string[];
  missing: string[];
  rationale: string;
}

export type OpportunitySource = "remotive" | "pasted" | "demo_sample";

export interface Opportunity {
  id: string;
  source: OpportunitySource;
  external_id: string | null;
  title: string;
  company: string | null;
  url: string | null;
  location: string | null;
  description: string;
  match: OpportunityMatch | null;
  match_source: ResultSource | null;
  created_at: string;
}

export interface JobListing {
  external_id: string;
  title: string;
  company: string;
  url: string;
  location: string;
  category: string;
  description: string;
  published_at: string;
}

export interface VisionBoard {
  id: string;
  opportunity_id: string | null;
  title: string;
  prompt: string;
  image_url: string;
  source: ResultSource;
  saved: boolean;
  /** True when the user's own photo was used as the reference for this board. */
  from_photo: boolean;
  created_at: string;
}

export type CriterionStatus = "met" | "partial" | "not_met";

export interface PaperChallengeInputs {
  sheets_used: number;
  tape_cm: number;
  height_cm: number;
  load_g: number;
  hold_seconds: number;
  iterations: number;
  build_minutes: number;
  reflection: string;
}

export interface CriterionResult {
  id: string;
  label: string;
  status: CriterionStatus;
  measured: string;
  target: string;
}

export interface CapabilityTestResult {
  capability: string;
  verdict: "supported" | "partially_supported" | "not_yet_supported";
  criteria: string[];
}

export interface PaperChallengeScore {
  criteria: CriterionResult[];
  capabilities: CapabilityTestResult[];
  efficiency_ratio: number | null;
  met_count: number;
}

export interface SegmentationBox {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  confidence: number | null;
}

export interface SegmentationEvidence {
  model: string;
  structure_prompt: string;
  load_prompt: string | null;
  structure_boxes: SegmentationBox[];
  load_boxes: SegmentationBox[];
  observations: string[];
}

/** One measurable criterion in a designed challenge. Scored by fixed comparison only. */
export interface ChallengeMeasure {
  id: string;
  label: string;
  unit: string;
  /** at_least: higher is better; at_most: lower is better. */
  direction: "at_least" | "at_most";
  target: number;
  /** Threshold for a partial result (between "no effort" and target). */
  partial: number;
  how_to_measure: string;
}

export interface ChallengeSpec {
  title: string;
  capability: string;
  why: string;
  duration_minutes: number;
  materials: string[];
  steps: string[];
  measures: ChallengeMeasure[];
  /** Short noun phrase SAM can look for in an evidence photo, or null when a photo can't show anything useful. */
  photo_subject: string | null;
  safety_note: string;
}

export interface Challenge {
  id: string;
  capability: string;
  title: string;
  spec: ChallengeSpec;
  source: ResultSource;
  model: string | null;
  created_at: string;
}

export interface CustomChallengeInputs {
  values: Record<string, number>;
  reflection: string;
}

export interface Experiment {
  id: string;
  challenge: string;
  challenge_id: string | null;
  inputs: PaperChallengeInputs | CustomChallengeInputs;
  score: PaperChallengeScore;
  evidence_mode: "sam" | "manual";
  segmentation: SegmentationEvidence | { manual_checks: string[]; note?: string } | null;
  photo_url: string | null;
  created_at: string;
}

export interface WorkspaceData {
  workspace: { id: string; display_name: string; is_demo: boolean };
  stories: Story[];
  analysis: Analysis | null;
  opportunities: Opportunity[];
  boards: VisionBoard[];
  experiments: Experiment[];
  challenges: Challenge[];
}

export interface ApiStatus {
  metaConfigured: boolean;
}
