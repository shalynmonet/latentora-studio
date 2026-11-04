import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Radio, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, SourceBadge } from "@/components/latentora/shared";
import { BlueprintSections, ConceptCard, EvidenceList, PrefList, PromptActions, RationaleView, downloadBlueprint } from "@/components/made-for-me/pieces";
import { DEMO_AMBITION, DEMO_PROFILES, type DemoProfile } from "@/lib/made-for-me-demo";
import { demoDesign, demoDiscover } from "@/lib/made-for-me.functions";
import { preferenceEvidence, type Blueprint, type Discovery, type Rationale } from "@/lib/made-for-me";
import recorded from "@/lib/made-for-me-recorded.json";
import recordedBuilds from "@/lib/made-for-me-recorded-builds.json";
import { MuseBuildPanel } from "@/components/made-for-me/build-with-muse";
import type { MuseBuild } from "@/lib/build-rules";
import { demoBuild } from "@/lib/made-for-me.functions";

export const Route = createFileRoute("/made-for-me/demo")({
  head: () => ({
    meta: [
      { title: "Same Ambition. Different Humans. Different Tools. (Demo) · Latentora" },
      { name: "description", content: "Two fictional people share one ambition. Latentora's personalisation pipeline designs them two different tools." },
      { property: "og:title", content: "Same Ambition. Different Humans. Different Tools." },
      { property: "og:description", content: "See how Made for Me turns different evidence and preferences into different personal inventions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

interface Run {
  discovery: Discovery;
  rationale: Rationale;
  blueprint: Blueprint;
  live: boolean;
}

// Replayed outputs came from a real Muse Spark run through this same pipeline, but they are
// NOT live now, so they're relabelled as sample data.
const RECORDED_AT = (recorded as { recorded_at: string }).recorded_at;
const replay = (k: "A" | "B"): Run => {
  const p = (recorded as unknown as { profiles: Record<string, { discovery: Discovery; rationale: Rationale; blueprint: Blueprint }> }).profiles[k]!;
  return {
    discovery: { ...p.discovery, source: "demo_sample" },
    rationale: { ...p.rationale, source: "demo_sample" },
    blueprint: { ...p.blueprint, source: "demo_sample" },
    live: false,
  };
};

function DemoPage() {
  const [runs, setRuns] = useState<Record<"A" | "B", Run>>({ A: replay("A"), B: replay("B") });
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");

  const runLive = async () => {
    setBusy(true);
    try {
      setStage("Muse Spark is proposing tools for both people…");
      const discs = await Promise.all(DEMO_PROFILES.map((p) => demoDiscover({ data: { profile: p.key } })));
      setStage("Designing and writing both blueprints…");
      const designs = await Promise.all(DEMO_PROFILES.map((p, i) => demoDesign({ data: { profile: p.key, concept: discs[i]!.concepts[0]! } })));
      setRuns({
        A: { discovery: discs[0]!, ...designs[0]!, live: true },
        B: { discovery: discs[1]!, ...designs[1]!, live: true },
      });
      toast.success("Both profiles ran live through the same pipeline.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The live run failed — the recorded run is still shown.");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const live = runs.A.live && runs.B.live;

  return (
    <div className="mx-auto max-w-7xl px-5 py-14">
      <Button asChild variant="ghost" size="sm">
        <Link to="/made-for-me">
          <ArrowLeft /> Made for Me
        </Link>
      </Button>
      <header className="mt-6 mb-10">
        <p className="eyebrow">Judge demo · two fictional people</p>
        <h1 className="mt-4 max-w-4xl text-5xl leading-[0.98] md:text-7xl">
          Same Ambition. <em className="text-gold-gradient">Different Humans.</em> Different Tools.{" "}
          <span className="align-middle text-2xl text-muted-foreground md:text-3xl">(Demo)</span>
        </h1>
        <p className="mt-6 font-display text-3xl text-pearl">“{DEMO_AMBITION}”</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {live ? (
            <Badge variant="live">Live run · just now</Badge>
          ) : (
            <Badge variant="sample">Replay of a recorded Muse Spark run ({RECORDED_AT.slice(0, 10)}) · not live</Badge>
          )}
          <Button onClick={runLive} disabled={busy} variant="outline">
            {busy ? <Loader2 className="animate-spin" /> : <Radio />} Run both live now
          </Button>
          {busy && (
            <span role="status" className="text-sm text-muted-foreground">
              {stage} (about a minute)
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {DEMO_PROFILES.map((p) => (
          <ProfileColumn key={`${p.key}-${runs[p.key].live ? "live" : "rec"}`} profile={p} run={runs[p.key]} />
        ))}
      </div>

      <Panel className="mt-10">
        <h2 className="text-3xl">How the personalisation was performed</h2>
        <ol className="mt-4 grid gap-4 text-sm text-muted-foreground md:grid-cols-4">
          <li>
            <span className="font-display text-2xl text-gold">1.</span> Each person's evidence (their words, projects and Capability Atlas
            entries) is given an id. Both share the identical ambition.
          </li>
          <li>
            <span className="font-display text-2xl text-gold">2.</span> The same Muse Spark prompt proposes three tools each. Any idea that
            doesn't cite real evidence ids is discarded by code.
          </li>
          <li>
            <span className="font-display text-2xl text-gold">3.</span> Their chosen interaction preferences are added as evidence; Muse Spark
            explains each design decision, and code labels it fact, preference or hypothesis.
          </li>
          <li>
            <span className="font-display text-2xl text-gold">4.</span> The blueprint is written from approved details only; fixed accessibility
            requirements for each preference are always added to the prompt.
          </li>
        </ol>
        <p className="mt-6 text-xs text-muted-foreground">
          Iris and Dev are fictional. This shows that different evidence and preferences produce different designs — it does not prove
          either tool is effective or accessible until someone builds and tests it.
        </p>
      </Panel>
    </div>
  );
}

type Design = { rationale: Rationale; blueprint: Blueprint; live: boolean };
type BuildState = { build: MuseBuild; recorded: boolean };
const RECORDED_BUILDS = recordedBuilds as unknown as Partial<Record<"A" | "B", MuseBuild>>;

function ProfileColumn({ profile, run }: { profile: DemoProfile; run: Run }) {
  const concepts = run.discovery.concepts;
  const first = concepts[0];
  const [sel, setSel] = useState(0);
  const [designs, setDesigns] = useState<Record<string, Design>>(
    first ? { [first.id]: { rationale: run.rationale, blueprint: run.blueprint, live: run.live } } : {},
  );
  const [busy, setBusy] = useState(false);
  const [builds, setBuilds] = useState<Record<string, BuildState>>(() => {
    const rec = RECORDED_BUILDS[profile.key];
    return first && !run.live && rec ? { [first.id]: { build: rec, recorded: true } } : {};
  });
  const concept = concepts[sel];
  const design = concept ? designs[concept.id] : undefined;
  const evidence = [...profile.evidence, ...preferenceEvidence(profile.preferences)];

  const designLive = async () => {
    if (!concept) return;
    setBusy(true);
    try {
      const res = await demoDesign({ data: { profile: profile.key, concept } });
      setDesigns((d) => ({ ...d, [concept.id]: { ...res, live: true } }));
      toast.success(`${concept.name} was designed live.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The live design failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="sample">Fictional profile {profile.key}</Badge>
          <SourceBadge source={run.discovery.source} model={run.discovery.model} />
        </div>
        <h2 className="mt-3 text-4xl">{profile.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{profile.portrait}</p>
        <p className="eyebrow mt-5 mb-2">Their evidence</p>
        <EvidenceList ids={profile.evidence.filter((e) => e.id !== "goal").map((e) => e.id)} evidence={profile.evidence} />
        <p className="eyebrow mt-5 mb-2">Their interaction preferences</p>
        <PrefList prefs={profile.preferences} />
      </Panel>

      <div>
        <p className="eyebrow mb-3">Their three ideas</p>
        <div role="tablist" aria-label={`${profile.name}'s ideas`} className="mb-4 flex flex-wrap gap-2">
          {concepts.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={sel === i}
              onClick={() => setSel(i)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                sel === i ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="mr-1.5 font-display text-gold">{["I", "II", "III"][i]}</span>
              {c.name}
            </button>
          ))}
        </div>
        {concept && <ConceptCard key={concept.id} concept={concept} index={sel} evidence={profile.evidence} />}
      </div>

      {design ? (
        <>
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-3xl">Why it was designed this way</h3>
              <SourceBadge source={design.live ? "meta_live" : "demo_sample"} model={design.rationale.model} />
            </div>
            <div className="mt-4">
              <RationaleView rationale={design.rationale} evidence={evidence} />
            </div>
          </Panel>

          <details className="glass rounded-3xl p-6">
            <summary className="cursor-pointer font-display text-2xl">Full blueprint &amp; build prompt</summary>
            <div className="mt-6">
              <BlueprintSections b={design.blueprint} />
              <pre className="mt-6 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-background/50 p-4 text-xs">{design.blueprint.build_prompt}</pre>
              <div className="mt-4">
                <PromptActions
                  prompt={design.blueprint.build_prompt}
                  onDownload={() => downloadBlueprint(design.blueprint, design.rationale, evidence, profile.evidence.map((e) => ({ id: e.id, text: e.text })))}
                />
              </div>
            </div>
          </details>

          <MuseBuildPanel
            key={concept!.id}
            compact
            build={builds[concept!.id]?.build ?? null}
            recorded={builds[concept!.id]?.recorded ?? false}
            onBuild={async () => {
              const { build_prompt: _p, personal_context: _c, preferences: _pr, source: _s, model: _m, ...bp } = design.blueprint;
              const res = await demoBuild({ data: { profile: profile.key, blueprint: bp } });
              setBuilds((b) => ({ ...b, [concept!.id]: { build: res, recorded: false } }));
              toast.success(`${concept!.name} was built live by Muse Wonder.`);
            }}
          />
        </>
      ) : (
        <Panel>
          <h3 className="text-3xl">Not designed yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The design reasons and blueprint for this idea haven't been written. Muse Spark can do it now through the same pipeline, using{" "}
            {profile.name.split(" ")[0]}'s preferences. It takes about a minute.
          </p>
          <Button className="mt-4" onClick={designLive} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Design this one live
          </Button>
          {busy && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Writing the design reasons and blueprint…
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
