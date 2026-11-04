import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageIntro, Panel, SourceBadge, WorkspaceGate, WorkspaceSwitcher, useBusy } from "@/components/latentora/shared";
import { ResumeDiscovery } from "@/components/latentora/resume-discovery";
import { addStory, analyzeStories, deleteStory } from "@/lib/latentora.functions";
import type { StoryKind, WorkspaceData } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — My Story · Latentora" },
      { name: "description", content: "Share your projects and experiences; Muse Spark reveals demonstrated and hidden capabilities." },
      { property: "og:title", content: "Discover — My Story · Latentora" },
      { property: "og:description", content: "Turn your stories into evidence-backed capabilities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

const KINDS: { value: StoryKind; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "experience", label: "Experience" },
  { value: "interest", label: "Interest" },
  { value: "accomplishment", label: "Accomplishment" },
];

function DiscoverPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro
        step={1}
        title={
          <>
            The story you've <em className="text-gold-gradient">already written</em>
          </>
        }
        sub="Add your résumé, or three or more projects, experiences, interests or accomplishments — or both. Muse Spark looks for the abilities inside them — and tells you which are evidenced and which are only hunches."
      >
        <WorkspaceSwitcher />
      </PageIntro>
      <WorkspaceGate>{(ws, refresh, id) => <Discover ws={ws} refresh={refresh} id={id} />}</WorkspaceGate>
    </div>
  );
}

function Discover({ ws, refresh, id }: { ws: WorkspaceData; refresh: () => void; id: string }) {
  const [kind, setKind] = useState<StoryKind>("project");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const save = useBusy();
  const analyze = useBusy();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2 || description.trim().length < 20) {
      toast.error("Give it a title and at least a couple of sentences.");
      return;
    }
    const ok = await save.run(() => addStory({ data: { id, kind, title, description } }));
    if (ok) {
      setTitle("");
      setDescription("");
      refresh();
    }
  };

  const runAnalysis = async () => {
    const res = await analyze.run(() => analyzeStories({ data: { id } }));
    if (res) {
      if (res.notice) toast.warning(res.notice);
      else toast.success("Muse Spark finished the analysis.");
      refresh();
    }
  };

  const hasResume = Boolean(ws.resume?.result.passages.length);
  const enough = ws.stories.length >= 3 || hasResume;

  return (
    <div className="space-y-10">
    <ResumeDiscovery ws={ws} refresh={refresh} id={id} />
    <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-6">
        <Panel>
          <h2 className="text-3xl">Add a story</h2>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Story type">
              {KINDS.map((k) => (
                <button
                  type="button"
                  key={k.value}
                  role="radio"
                  aria-checked={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    kind === k.value ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Organised a neighbourhood repair café" maxLength={140} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">What happened? What did you do?</Label>
              <Textarea
                id="desc"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Concrete details help: what you did, how, for whom, and what changed."
                maxLength={3000}
              />
            </div>
            <Button type="submit" disabled={save.busy}>
              {save.busy ? <Loader2 className="animate-spin" /> : <Plus />} Add story
            </Button>
          </form>
        </Panel>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl">Your stories ({ws.stories.length})</h3>
            {!enough && <span className="text-xs text-muted-foreground">Add a résumé above, or {3 - ws.stories.length} more stor{3 - ws.stories.length === 1 ? "y" : "ies"}, to unlock analysis</span>}
          </div>
          {ws.stories.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet. Start with something you're quietly proud of.</p>
          )}
          {ws.stories.map((s) => (
            <article key={s.id} className="glass group rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline" className="mb-2 capitalize">{s.kind}</Badge>
                  <h4 className="font-display text-xl">{s.title}</h4>
                </div>
                <button
                  aria-label={`Delete ${s.title}`}
                  className="text-muted-foreground opacity-60 transition hover:text-destructive group-hover:opacity-100"
                  onClick={async () => {
                    await deleteStory({ data: { id, storyId: s.id } });
                    refresh();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
            </article>
          ))}
          <Button size="lg" className="w-full" disabled={!enough || analyze.busy} onClick={runAnalysis}>
            {analyze.busy ? (
              <>
                <Loader2 className="animate-spin" /> Muse Spark is reading {hasResume && ws.stories.length ? "your stories and résumé" : hasResume ? "your résumé" : "your stories"}…
              </>
            ) : (
              <>
                <Sparkles /> {ws.analysis ? "Re-analyse with Muse Spark" : "Analyse with Muse Spark"}
              </>
            )}
          </Button>
        </div>
      </div>

      <AnalysisView ws={ws} busy={analyze.busy} />
    </div>
    </div>
  );
}

function AnalysisView({ ws, busy }: { ws: WorkspaceData; busy: boolean }) {
  const a = ws.analysis;
  if (!a)
    return (
      <Panel className="flex min-h-[420px] flex-col items-center justify-center text-center">
        <div className="relative mb-6 size-24">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="absolute size-2 animate-twinkle rounded-full bg-gold"
              style={{ left: `${20 + ((i * 37) % 60)}%`, top: `${15 + ((i * 53) % 70)}%`, animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </div>
        <h3 className="text-3xl">{busy ? "Mapping your stars…" : "Your capability map appears here"}</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Add your résumé or at least three stories, then run the analysis. It usually takes 10–30 seconds.
        </p>
      </Panel>
    );
  const r = a.result;
  const demonstrated = r.capabilities.filter((c) => c.status === "demonstrated");
  const hypothesized = r.capabilities.filter((c) => c.status === "hypothesized");
  return (
    <div className={cn("space-y-6 transition-opacity", busy && "opacity-50")}>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Reading</p>
          <SourceBadge source={a.source} model={a.model} />
        </div>
        <p className="mt-3 font-display text-2xl leading-snug">
          {r.summary || "These capabilities come from the résumé findings you confirmed. Press “Analyse with Muse Spark” to see the fuller picture."}
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="evidence">{ws.resume ? "Evidenced in your stories or résumé" : "Evidenced in your stories"}</Badge>
          </div>
          <ul className="space-y-4">
            {demonstrated.map((c) => (
              <li key={c.name}>
                <div className="font-display text-xl">
                  {c.name} <ResumeTag origin={c.origin} />
                </div>
                <ul className="mt-1 space-y-1">
                  {c.evidence.map((e, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      <span className="text-gold/80">“{e.story_title}”</span> — {e.detail}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {demonstrated.length === 0 && <li className="text-sm text-muted-foreground">None identified yet.</li>}
          </ul>
        </Panel>
        <Panel className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="hypothesis">AI hypotheses</Badge>
          </div>
          <ul className="space-y-4">
            {hypothesized.map((c) => (
              <li key={c.name}>
                <div className="font-display text-xl">
                  {c.name} <ResumeTag origin={c.origin} />
                </div>
                <p className="text-xs text-muted-foreground">{c.rationale}</p>
              </li>
            ))}
            {hypothesized.length === 0 && <li className="text-sm text-muted-foreground">None.</li>}
          </ul>
        </Panel>
      </div>

      {r.transferable_skills.length > 0 && (
        <Panel>
          <h3 className="text-2xl">Transferable skills</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {r.transferable_skills.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border p-4">
                <p className="font-display text-xl">{t.name}</p>
                <p className="text-xs text-lavender">from {t.from_context}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t.why}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.to_contexts.map((c) => (
                    <Badge key={c} variant="outline">{c}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {r.connections.length > 0 && (
          <Panel className="p-6">
            <h3 className="text-2xl">Unexpected connections</h3>
            <ul className="mt-3 space-y-3">
              {r.connections.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="text-gold">{c.between.join(" ✦ ")}</span>
                  <p className="text-muted-foreground">{c.insight}</p>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {r.needs_validation.length > 0 && (
          <Panel className="p-6">
            <h3 className="text-2xl">Worth testing</h3>
            <ul className="mt-3 space-y-3">
              {r.needs_validation.map((v, i) => (
                <li key={i} className="text-sm">
                  <span className="text-lavender">{v.capability}</span>
                  <p className="text-muted-foreground">{v.what_would_prove_it}</p>
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-2 px-0">
              <Link to="/experiment">Open the Proof Lab →</Link>
            </Button>
          </Panel>
        )}
      </div>

      <div className="flex justify-end">
        <Button asChild size="lg">
          <Link to="/explore">
            Find opportunities <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ResumeTag({ origin }: { origin?: "stories" | "resume" | "both" | undefined }) {
  if (origin !== "resume" && origin !== "both") return null;
  return (
    <Badge variant="outline" className="ml-1 align-middle text-[10px]">
      {origin === "both" ? "Stories + résumé" : "From your résumé"}
    </Badge>
  );
}
