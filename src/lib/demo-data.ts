// Demo profile for judges. Everything here is SAMPLE DATA, written by hand —
// it is never presented as live Meta output.
import type { AnalysisResult, JobListing, OpportunityMatch, StoryKind } from "./types";

export const DEMO_PROFILE_NAME = "Maya Okafor (demo profile)";

export const DEMO_STORIES: { kind: StoryKind; title: string; description: string }[] = [
  {
    kind: "experience",
    title: "Ran the night shift at a busy bakery",
    description:
      "For three years I managed the 2am–8am bake for a bakery producing ~1,200 items a day. I re-ordered the oven schedule to cut wasted heat-up time, trained four new bakers with a laminated step card I designed, and kept a notebook of every failed batch so we could see patterns (humidity was the usual cause).",
  },
  {
    kind: "project",
    title: "Built a tool library for my apartment block",
    description:
      "I noticed neighbours kept buying drills and ladders they used once. I surveyed 40 households, set up a shared shelf in the basement with a sign-out sheet, then moved it to a simple spreadsheet when it grew to 60 items. Three neighbours now help run it.",
  },
  {
    kind: "interest",
    title: "Origami and paper engineering",
    description:
      "I fold modular origami and pop-up cards. I've taught a free monthly workshop at the library for kids and adults, and I like figuring out why certain folds make paper surprisingly strong.",
  },
  {
    kind: "accomplishment",
    title: "Cut supply waste by 18%",
    description:
      "At the bakery I tracked flour and butter use against sales for two months, found we over-prepped on Mondays and Tuesdays, and proposed a new prep sheet. The owner adopted it and waste fell about 18% over the next quarter.",
  },
];

export const DEMO_ANALYSIS: AnalysisResult = {
  summary:
    "Maya repeatedly turns messy, physical operations into calm systems: she notices waste, measures it, and designs simple tools other people can follow. Her stories also show a hands-on feel for materials and a habit of teaching.",
  capabilities: [
    {
      name: "Process optimisation",
      category: "systems",
      status: "demonstrated",
      evidence: [
        { story_title: "Ran the night shift at a busy bakery", detail: "Re-ordered the oven schedule to cut heat-up time." },
        { story_title: "Cut supply waste by 18%", detail: "New prep sheet reduced waste ~18%." },
      ],
      rationale: "Two separate stories describe measuring a process and changing it with a result.",
    },
    {
      name: "Data-informed decisions",
      category: "analytical",
      status: "demonstrated",
      evidence: [
        { story_title: "Cut supply waste by 18%", detail: "Tracked use against sales for two months." },
        { story_title: "Ran the night shift at a busy bakery", detail: "Failed-batch notebook revealed humidity pattern." },
      ],
      rationale: "She collects evidence before proposing changes.",
    },
    {
      name: "Teaching and onboarding",
      category: "people",
      status: "demonstrated",
      evidence: [
        { story_title: "Ran the night shift at a busy bakery", detail: "Trained four bakers with a step card she designed." },
        { story_title: "Origami and paper engineering", detail: "Runs a monthly library workshop." },
      ],
      rationale: "Teaching appears in both work and hobby contexts.",
    },
    {
      name: "Community organising",
      category: "people",
      status: "demonstrated",
      evidence: [{ story_title: "Built a tool library for my apartment block", detail: "Surveyed 40 households; three neighbours now co-run it." }],
      rationale: "Started a shared resource and handed off parts of running it.",
    },
    {
      name: "Structural reasoning",
      category: "craft",
      status: "hypothesized",
      evidence: [{ story_title: "Origami and paper engineering", detail: "Curious why certain folds make paper strong." }],
      rationale: "Interest suggests an intuition for structure, but nothing measured yet.",
    },
    {
      name: "Service design",
      category: "creative",
      status: "hypothesized",
      evidence: [{ story_title: "Built a tool library for my apartment block", detail: "Designed sign-out flow from shelf to spreadsheet." }],
      rationale: "The tool library is a small service she designed end to end; it may transfer to formal service design.",
    },
    {
      name: "Calm under pressure",
      category: "resilience",
      status: "hypothesized",
      evidence: [{ story_title: "Ran the night shift at a busy bakery", detail: "Ran high-volume overnight production." }],
      rationale: "Inferred from the setting; she doesn't describe a specific crisis.",
    },
  ],
  transferable_skills: [
    {
      name: "Operations analysis",
      from_context: "Bakery prep and oven scheduling",
      to_contexts: ["Operations analyst", "Supply-chain coordinator", "Kitchen-tech product support"],
      why: "Measuring waste and redesigning a schedule is the core of operations work.",
    },
    {
      name: "Instructional design",
      from_context: "Laminated step cards and library workshops",
      to_contexts: ["Training coordinator", "Customer education", "Learning designer"],
      why: "She already turns tacit know-how into teachable steps.",
    },
    {
      name: "Community programme management",
      from_context: "Apartment tool library",
      to_contexts: ["Community manager", "Programme coordinator at a non-profit"],
      why: "Survey → pilot → scale → delegate is a programme lifecycle.",
    },
  ],
  connections: [
    {
      between: ["Structural reasoning", "Process optimisation"],
      insight: "Folding paper efficiently and scheduling ovens efficiently are both about getting more from fixed materials.",
    },
    {
      between: ["Teaching and onboarding", "Community organising"],
      insight: "Her projects survive because she teaches others to run them.",
    },
  ],
  needs_validation: [
    { capability: "Structural reasoning", what_would_prove_it: "A measured build challenge, e.g. a paper structure holding a load." },
    { capability: "Service design", what_would_prove_it: "Mapping a real service journey and testing one improvement with users." },
  ],
};

export const DEMO_LISTINGS: JobListing[] = [
  {
    provider: "demo_sample",
    kind: "job",
    pay: null,
    external_id: "demo-ops-1",
    title: "Operations Coordinator (sample listing)",
    company: "Sample Co. — not a real posting",
    url: "",
    location: "Remote",
    category: "Operations",
    description:
      "Sample listing for demo mode. Coordinate daily fulfilment, spot bottlenecks, build simple dashboards and SOPs, and train new team members.",
    published_at: "",
  },
  {
    provider: "demo_sample",
    kind: "contract",
    pay: null,
    external_id: "demo-edu-2",
    title: "Customer Education Specialist (sample listing)",
    company: "Sample Co. — not a real posting",
    url: "",
    location: "Remote",
    category: "Customer Success",
    description:
      "Sample listing for demo mode. Create how-to guides and run live onboarding workshops for customers of a hardware product.",
    published_at: "",
  },
];

export const DEMO_MATCHES: Record<string, OpportunityMatch> = {
  "demo-ops-1": {
    fit: "strong",
    abilities_used: ["Process optimisation", "Data-informed decisions", "Teaching and onboarding"],
    evidence: ["Re-ordered oven schedule", "Cut supply waste ~18%", "Trained four bakers with step cards"],
    missing: ["Experience with fulfilment software", "Formal dashboarding tools"],
    rationale: "The role is about spotting bottlenecks and writing SOPs — exactly what she did at the bakery.",
  },
  "demo-edu-2": {
    fit: "promising",
    abilities_used: ["Teaching and onboarding", "Structural reasoning"],
    evidence: ["Monthly library workshop", "Laminated step card"],
    missing: ["Product knowledge", "Remote facilitation experience"],
    rationale: "Strong teaching evidence; the hardware angle connects to her hands-on interest.",
  },
};
