// Offline heuristics used ONLY when the Meta API is unavailable.
// Results are labelled "offline_heuristic" in the UI — never presented as Meta output.
import type { AnalysisResult, Capability, CapabilityCategory, OpportunityMatch } from "./types";

const LEXICON: { name: string; category: CapabilityCategory; words: string[] }[] = [
  { name: "Process optimisation", category: "systems", words: ["schedule", "process", "workflow", "efficien", "waste", "streamlin", "optimi"] },
  { name: "Data-informed decisions", category: "analytical", words: ["data", "track", "measure", "spreadsheet", "analy", "metric", "pattern", "survey"] },
  { name: "Teaching and onboarding", category: "people", words: ["teach", "train", "workshop", "mentor", "coach", "onboard", "explain"] },
  { name: "Community organising", category: "people", words: ["community", "neighbo", "volunteer", "organis", "organiz", "group", "club"] },
  { name: "Leadership", category: "people", words: ["led", "lead", "manag", "team", "supervis"] },
  { name: "Visual and creative design", category: "creative", words: ["design", "draw", "paint", "illustrat", "photo", "art", "card"] },
  { name: "Hands-on making", category: "craft", words: ["build", "built", "craft", "fold", "wood", "sew", "repair", "prototype"] },
  { name: "Software and automation", category: "systems", words: ["code", "app", "script", "automat", "website", "software"] },
  { name: "Writing and storytelling", category: "creative", words: ["write", "wrote", "blog", "story", "newsletter", "article"] },
  { name: "Persistence", category: "resilience", words: ["years", "despite", "again", "failed", "night", "every"] },
];

export function heuristicAnalysis(stories: { title: string; description: string }[]): AnalysisResult {
  const caps: Capability[] = [];
  for (const entry of LEXICON) {
    const hits = stories.filter((s) => {
      const t = `${s.title} ${s.description}`.toLowerCase();
      return entry.words.some((w) => t.includes(w));
    });
    if (hits.length === 0) continue;
    caps.push({
      name: entry.name,
      category: entry.category,
      status: hits.length >= 2 ? "demonstrated" : "hypothesized",
      evidence: hits.slice(0, 3).map((s) => ({ story_title: s.title, detail: "Keyword match in your description." })),
      rationale:
        hits.length >= 2
          ? "Appears in more than one story (keyword match)."
          : "Appears in one story only (keyword match) — needs confirmation.",
    });
  }
  return {
    summary:
      "Offline keyword scan — the Meta model was unavailable, so this is a rough first pass. Run the live analysis for real reasoning.",
    capabilities: caps,
    transferable_skills: [],
    connections: [],
    needs_validation: caps
      .filter((c) => c.status === "hypothesized")
      .map((c) => ({ capability: c.name, what_would_prove_it: "A small, measurable challenge in Proof Lab." })),
  };
}

export function heuristicMatch(capabilities: string[], listingText: string): OpportunityMatch {
  const text = listingText.toLowerCase();
  const used = capabilities.filter((name) => {
    const entry = LEXICON.find((l) => l.name === name);
    const words = entry?.words ?? name.toLowerCase().split(/\s+/);
    return words.some((w) => text.includes(w));
  });
  const fit = used.length >= 3 ? "strong" : used.length === 2 ? "promising" : used.length === 1 ? "stretch" : "weak";
  return {
    fit,
    abilities_used: used,
    evidence: [],
    missing: ["Unknown — offline keyword scan cannot read requirements."],
    rationale: "Offline keyword overlap between your capabilities and the listing text.",
  };
}
