import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, Plus, Radar, Search, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageIntro, Panel, SourceBadge, WorkspaceGate, useBusy } from "@/components/latentora/shared";
import { deleteOpportunity, matchOpportunities, saveOpportunity, searchJobs } from "@/lib/latentora.functions";
import { PROVIDERS, PROVIDER_NAME } from "@/lib/listings";
import type { FitLevel, JobListing, ListingKind, ListingSearchResult, Opportunity, WorkspaceData } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore — Opportunity Radar · Latentora" },
      { name: "description", content: "Real remote jobs and contract gigs in one list, matched to your transferable abilities by Muse Spark." },
      { property: "og:title", content: "Explore — Opportunity Radar · Latentora" },
      { property: "og:description", content: "Find opportunities that fit what you can actually do." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

const FIT_STYLE: Record<FitLevel, string> = {
  strong: "border-gold/50 bg-gold/10 text-gold",
  promising: "border-lavender/50 bg-lavender/10 text-lavender",
  stretch: "border-pearl/40 bg-pearl/5 text-pearl",
  weak: "border-border text-muted-foreground",
};
const FIT_ORDER: FitLevel[] = ["strong", "promising", "stretch", "weak"];

function ExplorePage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro
        step={2}
        title={
          <>
            Opportunities that fit <em className="text-gold-gradient">what you can do</em>
          </>
        }
        sub="One list of live remote jobs and contract gigs from Remotive, Jobicy, Freelancer.com, OpenTrain AI and Terac — or paste a brief from Upwork, Twine, Mercor or anywhere else. Muse Spark matches on transferable abilities and is honest about what's missing."
      />
      <WorkspaceGate>{(ws, refresh, id) => <Explore ws={ws} refresh={refresh} id={id} />}</WorkspaceGate>
    </div>
  );
}

function Explore({ ws, refresh, id }: { ws: WorkspaceData; refresh: () => void; id: string }) {
  const suggestions = Array.from(
    new Set((ws.analysis?.result.transferable_skills ?? []).flatMap((t) => t.to_contexts)),
  ).slice(0, 6);
  const [query, setQuery] = useState(suggestions[0]?.split(" ").slice(0, 2).join(" ") ?? "operations");
  const [results, setResults] = useState<ListingSearchResult | null>(null);
  const [kind, setKind] = useState<ListingKind | "all">("all");
  const search = useBusy();
  const match = useBusy();
  const [adding, setAdding] = useState<string | null>(null);

  const doSearch = async (q = query) => {
    const r = await search.run(() => searchJobs({ data: { query: q } }), "The job feed didn't respond");
    if (r) {
      setResults(r);
      if (r.error) toast.warning(r.error);
    }
  };

  const add = async (l: JobListing) => {
    setAdding(l.external_id);
    try {
      await saveOpportunity({
        data: {
          id,
          listing: {
            source: l.provider,
            external_id: l.external_id,
            pay: l.pay,
            kind: l.kind,
            title: l.title,
            company: l.company,
            url: l.url || null,
            location: l.location,
            description: l.description.length >= 20 ? l.description : `${l.title} at ${l.company}. ${l.description}`,
          },
        },
      });
      refresh();
      toast.success("Added to your radar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add");
    } finally {
      setAdding(null);
    }
  };

  const unmatched = ws.opportunities.filter((o) => !o.match || o.match_source !== "meta_live").slice(0, 8);
  const runMatch = async (ids: string[]) => {
    if (!ws.analysis) {
      toast.error("Run Discover first so we know your capabilities.");
      return;
    }
    const r = await match.run(() => matchOpportunities({ data: { id, opportunityIds: ids } }));
    if (r) {
      if (r.notice) toast.warning(r.notice);
      else toast.success(`Muse Spark matched ${r.count} opportunit${r.count === 1 ? "y" : "ies"}.`);
      refresh();
    }
  };

  const savedIds = new Set(ws.opportunities.map((o) => o.external_id).filter(Boolean));
  const sorted = [...ws.opportunities].sort(
    (a, b) => FIT_ORDER.indexOf(a.match?.fit ?? "weak") - FIT_ORDER.indexOf(b.match?.fit ?? "weak") + (a.match ? 0 : 10) - (b.match ? 0 : 10),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
        <Panel>
          <h2 className="flex items-center gap-2 text-3xl">
            <Search className="size-5 text-gold" /> Live listings
          </h2>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
          >
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. operations, education, design" aria-label="Search listings" />
            <Button type="submit" disabled={search.busy}>
              {search.busy ? <Loader2 className="animate-spin" /> : <Search />} Search
            </Button>
          </form>
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.map((s) => {
                const q = s.split(" ").slice(0, 2).join(" ");
                return (
                  <button
                    key={s}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-gold/50 hover:text-foreground"
                    onClick={() => {
                      setQuery(q);
                      doSearch(q);
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
          <SourceLine results={results} />
          {results && results.listings.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter listings">
              {(
                [
                  ["all", "All"],
                  ["job", "Jobs"],
                  ["contract", "Contract gigs"],
                ] as const
              ).map(([k, label]) => {
                const n = k === "all" ? results.listings.length : results.listings.filter((l) => l.kind === k).length;
                return (
                  <button
                    key={k}
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      kind === k ? "border-gold/60 bg-gold/10 text-gold" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label} · {n}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1">
            {search.busy && <p className="text-sm text-muted-foreground">Scanning five feeds…</p>}
            {results && results.listings.length === 0 && <p className="text-sm text-muted-foreground">No listings for that search. Try a broader word.</p>}
            {results?.listings
              .filter((l) => kind === "all" || l.kind === kind)
              .map((l) => (
                <div key={l.external_id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.company} · {l.location}
                      </p>
                      {l.pay && <p className="mt-1 text-xs font-medium text-gold">{l.pay}</p>}
                    </div>
                    <Button size="sm" variant="outline" disabled={savedIds.has(l.external_id) || adding === l.external_id} onClick={() => add(l)}>
                      {adding === l.external_id ? <Loader2 className="animate-spin" /> : <Plus />}
                      {savedIds.has(l.external_id) ? "On radar" : "Add"}
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {l.provider === "demo_sample" ? <Badge variant="sample">Sample listing</Badge> : <Badge variant="outline">{PROVIDER_NAME[l.provider]}</Badge>}
                    <KindBadge kind={l.kind} />
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
                        Original listing <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Panel>
        <PasteForm id={id} refresh={refresh} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-3xl">
            <Radar className="size-5 text-gold" /> Your radar
          </h2>
          <Button disabled={match.busy || unmatched.length === 0} onClick={() => runMatch(unmatched.map((o) => o.id))}>
            {match.busy ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {match.busy ? "Matching…" : `Match ${unmatched.length || ""} with Muse Spark`}
          </Button>
        </div>
        {!ws.analysis && (
          <p className="text-sm text-warning">
            Matching needs your capability map. <Link to="/discover" className="underline">Run Discover first.</Link>
          </p>
        )}
        {sorted.length === 0 ? (
          <EmptyState title="Your radar is empty" body="Add live listings or paste a freelance brief to see how your abilities transfer." />
        ) : (
          sorted.map((o) => <OpportunityCard key={o.id} o={o} id={id} refresh={refresh} onMatch={() => runMatch([o.id])} busy={match.busy} />)
        )}
      </div>
    </div>
  );
}

function OpportunityCard({ o, id, refresh, onMatch, busy }: { o: Opportunity; id: string; refresh: () => void; onMatch: () => void; busy: boolean }) {
  const m = o.match;
  return (
    <article className="glass rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl leading-tight">{o.title}</h3>
          <p className="text-xs text-muted-foreground">
            {o.company ?? "—"} {o.location ? `· ${o.location}` : ""}
          </p>
          {o.pay && <p className="mt-1 text-xs font-medium text-gold">{o.pay}</p>}
        </div>
        {m && <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold capitalize", FIT_STYLE[m.fit])}>{m.fit} fit</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PROVIDER_NAME[o.source] && <Badge variant="outline">Source: {PROVIDER_NAME[o.source]}</Badge>}
        {o.source === "pasted" && <Badge variant="outline">Source: pasted brief</Badge>}
        {o.kind && <KindBadge kind={o.kind} />}
        {o.source === "demo_sample" && <Badge variant="sample">Sample listing · not real</Badge>}
        {m && <SourceBadge source={o.match_source} model="muse-spark-1.3" />}
        {o.url && (
          <a href={o.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
            Original listing <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {m ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-foreground/90">{m.rationale}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="eyebrow mb-1">Abilities used</p>
              <ul className="space-y-0.5 text-muted-foreground">{m.abilities_used.map((a) => <li key={a}>✦ {a}</li>)}</ul>
            </div>
            <div>
              <p className="eyebrow mb-1">Supporting evidence</p>
              <ul className="space-y-0.5 text-muted-foreground">{m.evidence.length ? m.evidence.map((a) => <li key={a}>· {a}</li>) : <li>—</li>}</ul>
            </div>
            <div>
              <p className="eyebrow mb-1">Missing</p>
              <ul className="space-y-0.5 text-muted-foreground">{m.missing.length ? m.missing.map((a) => <li key={a}>○ {a}</li>) : <li>Nothing obvious</li>}</ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{o.description}</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link to="/visualize" search={{ opp: o.id }}>
            Visualise this future
          </Link>
        </Button>
        {(!m || o.match_source !== "meta_live") && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onMatch}>
            <Wand2 /> Match live
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await deleteOpportunity({ data: { id, opportunityId: o.id } });
            refresh();
          }}
        >
          <Trash2 /> Remove
        </Button>
      </div>
    </article>
  );
}

function PasteForm({ id, refresh }: { id: string; refresh: () => void }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const { busy, run } = useBusy();
  return (
    <Panel>
      <h2 className="text-3xl">Paste a freelance brief</h2>
      <p className="mt-1 text-sm text-muted-foreground">From Upwork, Twine, Mercor, a friend's email — anything. Copy the text in; nothing is scraped.</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (title.trim().length < 2 || description.trim().length < 20) {
            toast.error("Add a title and the brief's text.");
            return;
          }
          const ok = await run(() =>
            saveOpportunity({
              data: { id, listing: { source: "pasted", external_id: null, title, company: company || null, url: url || null, location: null, description } },
            }),
          );
          if (ok) {
            setTitle("");
            setCompany("");
            setUrl("");
            setDescription("");
            toast.success("Brief added to your radar");
            refresh();
          }
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-title">Title</Label>
            <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-company">Client / platform</Label>
            <Input id="p-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-url">Link (optional)</Label>
          <Input id="p-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={500} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-desc">Brief</Label>
          <Textarea id="p-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={6000} />
        </div>
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add brief
        </Button>
      </form>
    </Panel>
  );
}

function KindBadge({ kind }: { kind: ListingKind }) {
  return kind === "contract" ? (
    <span className="rounded-full border border-lavender/40 bg-lavender/10 px-2 py-0.5 text-[11px] text-lavender">Contract gig</span>
  ) : (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Job</span>
  );
}

function SourceLine({ results }: { results: ListingSearchResult | null }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
      Live from{" "}
      {PROVIDERS.map((p, i) => {
        const r = results?.sources.find((s) => s.provider === p.id);
        return (
          <span key={p.id}>
            <a className="text-gold hover:underline" href={p.url} target="_blank" rel="noreferrer">
              {p.name}
            </a>
            {r && <span className={r.ok ? "" : "text-warning"}> ({r.ok ? r.count : "offline"})</span>}
            {i < PROVIDERS.length - 2 ? ", " : i === PROVIDERS.length - 2 ? " and " : ""}
          </span>
        );
      })}
      . Free public feeds, refreshed every few hours. Apply on the original site.
    </p>
  );
}
