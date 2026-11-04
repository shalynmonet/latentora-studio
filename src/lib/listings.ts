// Pure helpers for the unified job + contract-gig list (browser-safe, tested).
import type { JobListing, ListingProvider } from "./types";

export const PROVIDERS: { id: ListingProvider; name: string; url: string; cacheHours: number }[] = [
  // Remotive asks for at most ~4 requests/day, so its cache is long.
  { id: "remotive", name: "Remotive", url: "https://remotive.com", cacheHours: 12 },
  { id: "jobicy", name: "Jobicy", url: "https://jobicy.com", cacheHours: 3 },
  { id: "freelancer", name: "Freelancer.com", url: "https://www.freelancer.com", cacheHours: 2 },
  { id: "opentrain", name: "OpenTrain AI", url: "https://www.opentrain.ai/jobs/", cacheHours: 2 },
  { id: "terac", name: "Terac", url: "https://terac.com/opportunities", cacheHours: 3 },
];

export const PROVIDER_NAME: Record<string, string> = Object.fromEntries(PROVIDERS.map((p) => [p.id, p.name]));

const CONTRACT_WORDS = /contract|freelance|temporary|part[- ]?time|gig|internship/i;

/** "contract" when the listing's own job-type labels say so; otherwise "job". */
export function kindFromLabels(labels: (string | null | undefined)[]): "job" | "contract" {
  return labels.some((l) => l && CONTRACT_WORDS.test(l)) ? "contract" : "job";
}

function money(n: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  const v = n >= 1000 ? Math.round(n).toLocaleString("en-US") : String(Math.round(n * 100) / 100);
  return sym ? `${sym}${v}` : `${v} ${currency}`;
}

/** Formats pay exactly as the source states it; returns null when the source gives none. */
export function formatPay(min: number | null | undefined, max: number | null | undefined, currency: string | null | undefined, period: string | null | undefined): string | null {
  const lo = typeof min === "number" && min > 0 ? min : null;
  const hi = typeof max === "number" && max > 0 ? max : null;
  if (lo == null && hi == null) return null;
  const cur = (currency || "USD").toUpperCase();
  const hasSym = ["USD", "EUR", "GBP"].includes(cur);
  const num = (n: number) => (hasSym ? money(n, cur) : money(n, cur).replace(` ${cur}`, ""));
  const range = lo != null && hi != null && lo !== hi ? `${num(lo)}–${num(hi)}` : num((hi ?? lo)!);
  const withCode = hasSym ? range : `${range} ${cur}`;
  const per = period ? ` ${period}` : "";
  return `${withCode}${per}`;
}

/** Keyword filter for sources without server-side search: every word must appear. */
export function matchesQuery(q: string, ...fields: (string | null | undefined)[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Mixes provider results round-robin so no single source dominates, and drops duplicates by title+company. */
export function interleave(groups: JobListing[][], limit = 40): JobListing[] {
  const out: JobListing[] = [];
  const seen = new Set<string>();
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max && out.length < limit; i++) {
    for (const g of groups) {
      const l = g[i];
      if (!l) continue;
      const key = `${l.title.trim().toLowerCase()}|${l.company.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(l);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** How many listings Explore pre-populates from the capability map. */
export const PICKS_COUNT = 5;

/**
 * Search terms for Explore's pre-populated picks, derived only from the person's own capability map:
 * the contexts their transferable skills point to first, then their strongest capability names.
 */
export function pickQueries(
  analysis: { capabilities: { name: string; status: string }[]; transferable_skills: { to_contexts: string[] }[] } | null | undefined,
  max = 3,
): string[] {
  if (!analysis) return [];
  const short = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  const ordered = [
    ...analysis.transferable_skills.flatMap((t) => t.to_contexts),
    ...analysis.capabilities.filter((c) => c.status === "demonstrated").map((c) => c.name),
    ...analysis.capabilities.map((c) => c.name),
  ];
  const out: string[] = [];
  for (const o of ordered) {
    const q = short(o);
    if (q.length >= 3 && !out.includes(q)) out.push(q);
    if (out.length >= max) break;
  }
  return out;
}
