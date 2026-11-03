// Fetchers for free, official/public listing feeds. Server-only.
// Remotive: public API. Jobicy: public API (credit + link back required).
// Freelancer.com: public projects endpoint. OpenTrain: documented tokenless public API.
import { formatPay, kindFromLabels, matchesQuery } from "./listings";
import type { JobListing, ListingProvider } from "./types";

const UA = { "User-Agent": "Latentora/1.0 (+https://latentora.sha-i.com)", Accept: "application/json" };
const PER_SOURCE = 12;

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

async function remotive(q: string): Promise<JobListing[]> {
  type J = { id: number; title: string; company_name: string; url: string; candidate_required_location?: string; category?: string; description?: string; publication_date?: string; job_type?: string; salary?: string };
  const json = await getJSON<{ jobs?: J[] }>(`https://remotive.com/api/remote-jobs?limit=${PER_SOURCE}${q ? `&search=${encodeURIComponent(q)}` : ""}`);
  return (json.jobs ?? []).slice(0, PER_SOURCE).map((j) => ({
    provider: "remotive",
    external_id: `remotive:${j.id}`,
    title: j.title,
    company: j.company_name,
    url: j.url,
    location: j.candidate_required_location || "Remote",
    category: j.category ?? "",
    description: stripHtml(j.description ?? "").slice(0, 4000),
    published_at: j.publication_date ?? "",
    kind: kindFromLabels([j.job_type?.replace("_", " ")]),
    pay: j.salary?.trim() || null,
  }));
}

async function jobicy(q: string): Promise<JobListing[]> {
  type J = { id: number; url: string; jobTitle: string; companyName: string; jobIndustry?: string[]; jobType?: string[]; jobGeo?: string; pubDate?: string; jobDescription?: string; jobExcerpt?: string; salaryMin?: number; salaryMax?: number; salaryCurrency?: string; salaryPeriod?: string };
  const json = await getJSON<{ jobs?: J[] }>(`https://jobicy.com/api/jobs?count=${PER_SOURCE}${q ? `&tag=${encodeURIComponent(q)}` : ""}`);
  return (json.jobs ?? []).slice(0, PER_SOURCE).map((j) => ({
    provider: "jobicy",
    external_id: `jobicy:${j.id}`,
    title: stripHtml(j.jobTitle),
    company: j.companyName,
    url: j.url,
    location: j.jobGeo ? `Remote · ${j.jobGeo.replace(/\s+/g, " ")}` : "Remote",
    category: j.jobIndustry?.[0] ?? "",
    description: stripHtml(j.jobDescription || j.jobExcerpt || "").slice(0, 4000),
    published_at: j.pubDate ?? "",
    kind: kindFromLabels(j.jobType ?? []),
    pay: formatPay(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod ? `/ ${j.salaryPeriod.replace(/ly$/, "").replace("dai", "day")}` : null),
  }));
}

async function freelancer(q: string): Promise<JobListing[]> {
  type P = { id: number; title: string; seo_url: string; type: "fixed" | "hourly"; budget?: { minimum?: number; maximum?: number }; currency?: { code?: string }; time_submitted?: number; description?: string; preview_description?: string; jobs?: { name: string }[] };
  const url = `https://www.freelancer.com/api/projects/0.1/projects/active/?limit=30&full_description=true&job_details=true&compact=true${q ? `&query=${encodeURIComponent(q)}` : ""}`;
  const json = await getJSON<{ result?: { projects?: P[] } }>(url);
  // Freelancer's search is loose, so keep only projects that actually mention the words.
  return (json.result?.projects ?? [])
    .filter((p) => matchesQuery(q, p.title, p.description, p.preview_description, p.jobs?.map((j) => j.name).join(" ")))
    .slice(0, PER_SOURCE)
    .map((p) => ({
    provider: "freelancer",
    external_id: `freelancer:${p.id}`,
    title: p.title,
    company: "Freelancer.com client",
    url: `https://www.freelancer.com/projects/${p.seo_url}`,
    location: "Remote",
    category: p.jobs?.slice(0, 3).map((j) => j.name).join(", ") ?? "",
    description: stripHtml(p.description || p.preview_description || "").slice(0, 4000),
    published_at: p.time_submitted ? new Date(p.time_submitted * 1000).toISOString() : "",
    kind: "contract" as const,
    pay: formatPay(p.budget?.minimum, p.budget?.maximum, p.currency?.code, p.type === "hourly" ? "/ hour" : "fixed price"),
  }));
}

async function opentrain(q: string): Promise<JobListing[]> {
  type J = {
    id: string; title: string; url: string; companyName?: string; summary?: string | null; descriptionText?: string; category?: string; datePosted?: string; countries?: string[];
    pay?: { currency?: string; paymentType?: string; hourlyMin?: number | null; hourlyMax?: number | null; fixedPrice?: number | null; perLabelRate?: number | null };
  };
  const json = await getJSON<{ jobs?: J[] }>(`https://app.opentrain.ai/api/public/v1/jobs?limit=${PER_SOURCE}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  return (json.jobs ?? []).slice(0, PER_SOURCE).map((j) => {
    const p = j.pay;
    let pay: string | null = null;
    if (p?.paymentType === "PAY_PER_HOUR") pay = formatPay(p.hourlyMin, p.hourlyMax, p.currency, "/ hour");
    else if (p?.paymentType === "FIXED_PRICE") pay = formatPay(p.fixedPrice, null, p.currency, "fixed price");
    else if (p?.paymentType === "PAY_PER_LABEL") pay = formatPay(p.perLabelRate, null, p.currency, "/ label");
    const countries = j.countries?.length ? j.countries.slice(0, 4).join(", ") + (j.countries.length > 4 ? "…" : "") : "worldwide";
    return {
      provider: "opentrain" as const,
      external_id: `opentrain:${j.id}`,
      title: j.title,
      company: j.companyName || "OpenTrain AI",
      url: j.url,
      location: `Remote · ${countries}`,
      category: (j.category ?? "").replace(/-/g, " "),
      description: (j.descriptionText || j.summary || "").slice(0, 4000),
      published_at: j.datePosted ?? "",
      kind: "contract" as const,
      pay,
    };
  });
}

// Terac posts its paid expert gigs on its public Ashby job board (official posting API, no key).
// The board has no search parameter, so we filter by keyword here.
async function terac(q: string): Promise<JobListing[]> {
  type J = { id: string; title: string; department?: string; employmentType?: string; location?: string; isRemote?: boolean; isListed?: boolean; publishedAt?: string; jobUrl: string; descriptionPlain?: string; compensation?: { scrapeableCompensationSalarySummary?: string | null; compensationTierSummary?: string | null } | null };
  const json = await getJSON<{ jobs?: J[] }>("https://api.ashbyhq.com/posting-api/job-board/terac?includeCompensation=true");
  return (json.jobs ?? [])
    .filter((j) => j.isListed !== false && matchesQuery(q, j.title, j.department, j.descriptionPlain))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, PER_SOURCE)
    .map((j) => ({
      provider: "terac" as const,
      external_id: `terac:${j.id}`,
      title: j.title,
      company: "Terac",
      url: j.jobUrl,
      location: j.isRemote ? `Remote · ${j.location ?? ""}`.replace(/ · $/, "") : (j.location ?? ""),
      category: j.department ?? "",
      description: (j.descriptionPlain ?? "").replace(/\s+/g, " ").trim().slice(0, 4000),
      published_at: j.publishedAt ?? "",
      kind: kindFromLabels([j.employmentType]),
      pay: j.compensation?.scrapeableCompensationSalarySummary || null,
    }));
}

export const FETCHERS: Record<ListingProvider, (q: string) => Promise<JobListing[]>> = { remotive, jobicy, freelancer, opentrain, terac };
