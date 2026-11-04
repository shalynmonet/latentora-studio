// Résumé discovery rules. Deterministic and client-safe.
// Muse Spark proposes findings with verbatim quotes; these rules decide what survives,
// how each finding is labelled, and how approved findings merge into the Capability Atlas.
import type {
  Analysis,
  Capability,
  CapabilityCategory,
  ResumeAnalysisResult,
  ResumeClassification,
  ResumeDecision,
  ResumeFinding,
  ResumePassage,
  ResumeProfile,
  ResultSource,
} from "./types";

export const RESUME_LIMITS = {
  maxPdfBytes: 5 * 1024 * 1024,
  maxTextChars: 40_000,
  minTextChars: 200,
  maxPassages: 40,
  maxQuoteChars: 400,
  maxFindings: 14,
} as const;

export const RESUME_EVIDENCE_LABEL = "Your résumé";

const CATEGORIES: CapabilityCategory[] = ["craft", "systems", "people", "creative", "analytical", "resilience"];

/** Protected characteristics Latentora must never infer or store as a "capability". */
const SENSITIVE =
  /\b(age|aged|ageing|gender|sex|sexual|sexuality|orientation|religion|religious|faith|ethnic|ethnicity|race|racial|nationality|citizenship|immigration|disability|disabled|pregnan\w*|marital|married|political|caste|veteran status)\b/i;

export function isSensitive(text: string) {
  return SENSITIVE.test(text);
}

/** Lowercase, unify quotes/dashes/bullets, collapse whitespace — so quotes match across PDF/DOCX extraction quirks. */
export function normalizeForMatch(s: string) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[•▪●◦·]/g, " ")
    .replace(/-\s+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteInDocument(quote: string, docText: string) {
  const q = normalizeForMatch(quote).replace(/^["'.…\s]+|["'.…\s]+$/g, "");
  if (q.length < 3) return false;
  return normalizeForMatch(docText).includes(q);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Validate Muse Spark's résumé analysis.
 * - Quotes not found in the document text are dropped (when text is available).
 * - Every finding/profile entry may only cite surviving passages.
 * - "direct" needs a cited passage; "hypothesis" needs one too, otherwise it becomes "insufficient".
 * - Sensitive/protected attributes are removed entirely.
 */
export function sanitizeResumeAnalysis(raw: unknown, docText: string | null): ResumeAnalysisResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const passages: ResumePassage[] = [];
  const seen = new Set<string>();
  for (const p of arr(r["passages"])) {
    const o = p as Record<string, unknown>;
    const id = str(o["id"], 20);
    const quote = str(o["quote"], RESUME_LIMITS.maxQuoteChars);
    if (!id || !quote || seen.has(id) || isSensitive(quote)) continue;
    const verified = docText ? quoteInDocument(quote, docText) : null;
    if (verified === false) continue;
    seen.add(id);
    passages.push({ id, quote, verified });
    if (passages.length >= RESUME_LIMITS.maxPassages) break;
  }
  const ids = new Set(passages.map((p) => p.id));
  const cite = (v: unknown) => [...new Set(arr(v).map((x) => str(x, 20)).filter((x) => ids.has(x)))];

  const prof = (r["profile"] ?? {}) as Record<string, unknown>;
  const profile: ResumeProfile = {
    roles: arr(prof["roles"])
      .map((x) => {
        const o = x as Record<string, unknown>;
        return {
          title: str(o["title"], 140),
          organization: str(o["organization"], 140),
          period: str(o["period"], 60),
          responsibilities: arr(o["responsibilities"]).map((t) => str(t, 240)).filter(Boolean).slice(0, 6),
          passage_ids: cite(o["passage_ids"]),
        };
      })
      .filter((x) => x.title && x.passage_ids.length)
      .slice(0, 12),
    education: arr(prof["education"])
      .map((x) => {
        const o = x as Record<string, unknown>;
        return { credential: str(o["credential"], 160), institution: str(o["institution"], 140), period: str(o["period"], 60), passage_ids: cite(o["passage_ids"]) };
      })
      .filter((x) => x.credential && x.passage_ids.length)
      .slice(0, 8),
    projects: arr(prof["projects"])
      .map((x) => {
        const o = x as Record<string, unknown>;
        return { name: str(o["name"], 140), detail: str(o["detail"], 280), passage_ids: cite(o["passage_ids"]) };
      })
      .filter((x) => x.name && x.passage_ids.length)
      .slice(0, 10),
    accomplishments: arr(prof["accomplishments"])
      .map((x) => {
        const o = x as Record<string, unknown>;
        return { text: str(o["text"], 280), passage_ids: cite(o["passage_ids"]) };
      })
      .filter((x) => x.text && x.passage_ids.length)
      .slice(0, 12),
    skills_named: arr(prof["skills_named"])
      .map((x) => {
        const o = x as Record<string, unknown>;
        return { name: str(o["name"], 80), passage_ids: cite(o["passage_ids"]) };
      })
      .filter((x) => x.name && x.passage_ids.length && !isSensitive(x.name))
      .slice(0, 24),
  };

  const findings: ResumeFinding[] = [];
  const names = new Set<string>();
  for (const f of arr(r["findings"])) {
    const o = f as Record<string, unknown>;
    const name = str(o["name"], 60);
    const explanation = str(o["explanation"], 400);
    if (!name || names.has(nameKey(name)) || isSensitive(name) || isSensitive(explanation)) continue;
    const passage_ids = cite(o["passage_ids"]);
    const claimed = o["classification"];
    let classification: ResumeClassification =
      claimed === "direct" || claimed === "hypothesis" || claimed === "insufficient" ? claimed : "insufficient";
    if (classification === "direct" && passage_ids.length === 0) classification = "hypothesis";
    if (classification === "hypothesis" && passage_ids.length === 0) classification = "insufficient";
    const category = CATEGORIES.includes(o["category"] as CapabilityCategory) ? (o["category"] as CapabilityCategory) : "craft";
    names.add(nameKey(name));
    findings.push({
      id: `f${findings.length + 1}`,
      name,
      category,
      classification,
      named_in_resume: o["named_in_resume"] === true,
      explanation,
      passage_ids,
    });
    if (findings.length >= RESUME_LIMITS.maxFindings) break;
  }

  const beyondRaw = (r["beyond"] ?? {}) as Record<string, unknown>;
  const known = new Set(findings.map((f) => nameKey(f.name)));
  const beyond = {
    headline: str(beyondRaw["headline"], 160),
    insight: str(beyondRaw["insight"], 600),
    connections: arr(beyondRaw["connections"])
      .map((c) => {
        const o = c as Record<string, unknown>;
        return { between: arr(o["between"]).map((b) => str(b, 60)).filter(Boolean), insight: str(o["insight"], 300) };
      })
      .filter((c) => c.between.length >= 2 && c.between.every((b) => known.has(nameKey(b))) && c.insight)
      .slice(0, 4),
  };

  return { passages, profile, findings, beyond };
}

/** Turn confirmed findings into Atlas capabilities. Confirmation never upgrades a hypothesis to "demonstrated". */
export function approvedCapabilities(result: ResumeAnalysisResult, review: Record<string, ResumeDecision>): Capability[] {
  const byId = new Map(result.passages.map((p) => [p.id, p]));
  const out: Capability[] = [];
  const seen = new Set<string>();
  for (const f of result.findings) {
    const d = review[f.id];
    if (d?.decision !== "confirmed") continue;
    const name = (d.name ?? "").trim().slice(0, 60) || f.name;
    if (seen.has(nameKey(name)) || isSensitive(name)) continue;
    seen.add(nameKey(name));
    out.push({
      name,
      category: f.category,
      status: f.classification === "direct" ? "demonstrated" : "hypothesized",
      evidence: f.passage_ids
        .map((id) => byId.get(id))
        .filter((p): p is ResumePassage => Boolean(p))
        .map((p) => ({ story_title: RESUME_EVIDENCE_LABEL, detail: `“${p.quote}”` })),
      rationale: f.explanation,
      origin: "resume",
    });
  }
  return out;
}

const RANK = { demonstrated: 2, hypothesized: 1 } as const;

/**
 * Merge approved résumé capabilities into the story analysis.
 * Same name → one capability; the stronger status wins; evidence is appended, never replaced.
 * Story capabilities are never removed or downgraded.
 */
export function mergeResumeIntoAnalysis(
  analysis: Analysis | null,
  resumeCaps: Capability[],
  resumeMeta: { source: ResultSource; model: string | null; created_at: string } | null,
): Analysis | null {
  if (!resumeCaps.length) return analysis;
  const base: Analysis = analysis ?? {
    id: "resume",
    source: resumeMeta?.source ?? "meta_live",
    model: resumeMeta?.model ?? null,
    created_at: resumeMeta?.created_at ?? new Date(0).toISOString(),
    result: { summary: "", capabilities: [], transferable_skills: [], connections: [], needs_validation: [] },
  };
  const caps: Capability[] = base.result.capabilities.map((c) => ({ ...c, evidence: [...c.evidence] }));
  for (const rc of resumeCaps) {
    const existing = caps.find((c) => nameKey(c.name) === nameKey(rc.name));
    if (!existing) {
      caps.push(rc);
      continue;
    }
    for (const e of rc.evidence) {
      if (!existing.evidence.some((x) => x.story_title === e.story_title && x.detail === e.detail)) existing.evidence.push(e);
    }
    if (RANK[rc.status] > RANK[existing.status]) existing.status = rc.status;
    existing.origin = existing.origin === "resume" ? "resume" : "both";
  }
  return { ...base, result: { ...base.result, capabilities: caps } };
}
