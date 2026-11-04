import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookmarkCheck, Bookmark, Loader2, Pencil, Plus, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, SourceBadge, useBusy } from "@/components/latentora/shared";
import {
  BlueprintSections,
  BuilderPicker,
  ConceptCard,
  DetailsReview,
  EvidenceList,
  PrefList,
  PreferencesPanel,
  PromptActions,
  RationaleView,
  downloadBlueprint,
} from "./pieces";
import {
  answerFollowUps,
  buildBlueprint,
  deleteInvention,
  designForMe,
  getInvention,
  listInventions,
  refreshConcepts,
  rejectConcept,
  startInvention,
  submitInventionFeedback,
  updateInvention,
} from "@/lib/made-for-me.functions";
import { preferenceEvidence } from "@/lib/made-for-me";
import type { ApprovedDetail, Builder, Customization, Invention, InventionFeedback, Pathway, PreferenceKey, ToolConcept } from "@/lib/made-for-me";
import { cn } from "@/lib/utils";

const inventionsKey = (id: string) => ["inventions", id] as const;
const inventionKey = (id: string, inv: string) => ["invention", id, inv] as const;

function Working({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="glass flex items-center gap-3 rounded-3xl p-6 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-gold" /> {label}
    </div>
  );
}

export function MadeForMeFlow({ workspaceId, inventionId }: { workspaceId: string; inventionId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const open = (inv?: string) => navigate({ to: "/made-for-me", search: inv ? { i: inv } : {}, replace: false });
  const inv = useQuery({
    queryKey: inventionKey(workspaceId, inventionId ?? ""),
    queryFn: () => getInvention({ data: { id: workspaceId, inventionId: inventionId! } }),
    enabled: Boolean(inventionId),
    retry: false,
  });
  const set = (i: Invention) => {
    qc.setQueryData(inventionKey(workspaceId, i.id), i);
    qc.invalidateQueries({ queryKey: inventionsKey(workspaceId) });
  };

  if (!inventionId) return <Entry workspaceId={workspaceId} onCreated={(i) => { set(i); open(i.id); }} onOpen={open} />;
  if (inv.isLoading) return <Working label="Opening your invention…" />;
  if (inv.error || !inv.data)
    return (
      <Panel>
        <p>That invention isn't in this workspace.</p>
        <Button className="mt-4" onClick={() => open()}>
          Start a new one
        </Button>
      </Panel>
    );
  return <InventionView key={inv.data.id} workspaceId={workspaceId} inv={inv.data} set={set} onNew={() => open()} />;
}

/* -------------------------------- entry -------------------------------- */

function Entry({ workspaceId, onCreated, onOpen }: { workspaceId: string; onCreated: (i: Invention) => void; onOpen: (id: string) => void }) {
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [ambition, setAmbition] = useState("");
  const [friction, setFriction] = useState("");
  const [style, setStyle] = useState("");
  const { busy, run } = useBusy();
  const showA = pathway === "achieve" || pathway === "both";
  const showB = pathway === "easier" || pathway === "both";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pathway) return;
    if ((showA ? ambition.trim().length : 0) < 8 && (showB ? friction.trim().length : 0) < 8) {
      toast.error("A sentence or two is enough — tell us a little more.");
      return;
    }
    const res = await run(() =>
      startInvention({
        data: { id: workspaceId, pathway, ambition: showA ? ambition : "", friction: showB ? friction : "", working_style: style },
      }),
    );
    if (res) onCreated(res);
  };

  const PATHS: { key: Pathway; title: string; body: string }[] = [
    { key: "achieve", title: "Help me achieve something", body: "For ambitions, goals or experiences you want to pursue." },
    { key: "easier", title: "Help me make something easier", body: "For friction, unnecessary effort or barriers in your day." },
    { key: "both", title: "Both", body: "Something you want to do, and something in the way." },
  ];

  return (
    <div className="space-y-10">
      <div id="start" className="scroll-mt-24">
        <p className="eyebrow mb-4">Choose where to begin</p>
        <div role="radiogroup" aria-label="Starting pathway" className="grid gap-4 md:grid-cols-3">
          {PATHS.map((p, i) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={pathway === p.key}
              onClick={() => setPathway(p.key)}
              className={cn(
                "glass rounded-3xl p-6 text-left transition-all hover:shadow-glow motion-safe:hover:-translate-y-0.5",
                pathway === p.key && "ring-2 ring-gold/70 shadow-glow",
              )}
            >
              <span className="font-display text-3xl text-gold-gradient">{["A", "B", "A+B"][i]}</span>
              <span className="mt-2 block text-2xl font-display">{p.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{p.body}</span>
            </button>
          ))}
        </div>
      </div>

      {pathway && (
        <Panel className="motion-safe:animate-rise">
          <form onSubmit={submit} className="space-y-5">
            {showA && (
              <div>
                <Label htmlFor="mfm-ambition" className="text-xl font-display">
                  What would you love to do, become, or accomplish?
                </Label>
                <Textarea id="mfm-ambition" className="mt-2" rows={3} maxLength={1000} value={ambition} onChange={(e) => setAmbition(e.target.value)} />
              </div>
            )}
            {showB && (
              <div>
                <Label htmlFor="mfm-friction" className="text-xl font-display">
                  What's something in your life that takes more effort than it should?
                </Label>
                <Textarea id="mfm-friction" className="mt-2" rows={3} maxLength={1000} value={friction} onChange={(e) => setFriction(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="mfm-style">How do you like to work? Anything you already use or work around? (optional)</Label>
              <Input id="mfm-style" className="mt-2" maxLength={600} value={style} onChange={(e) => setStyle(e.target.value)} placeholder="e.g. I think out loud, I keep everything in my phone's notes" />
            </div>
            <p className="text-xs text-muted-foreground">
              Latentora also uses the stories and Capability Atlas already in this workspace. You don't need to know what kind of tool you want.
            </p>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Discover What I Need
            </Button>
            {busy && <p className="text-sm text-muted-foreground" role="status">Muse Spark is reading your story — usually 15–30 seconds.</p>}
          </form>
        </Panel>
      )}

      <Possibilities workspaceId={workspaceId} onOpen={onOpen} />
    </div>
  );
}

function Possibilities({ workspaceId, onOpen }: { workspaceId: string; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: inventionsKey(workspaceId), queryFn: () => listInventions({ data: { id: workspaceId } }) });
  const saved = (data ?? []).filter((i) => i.saved);
  const drafts = (data ?? []).filter((i) => !i.saved);
  if (!data?.length) return null;
  const remove = async (id: string) => {
    if (!confirm("Delete this invention and its blueprint?")) return;
    await deleteInvention({ data: { id: workspaceId, inventionId: id } });
    qc.invalidateQueries({ queryKey: inventionsKey(workspaceId) });
  };
  const Row = ({ i }: { i: Invention }) => (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl">{i.blueprint?.tool_name ?? i.selected?.name ?? (i.ambition || i.friction).slice(0, 70)}</p>
        <p className="text-xs text-muted-foreground">
          {i.blueprint ? "Blueprint ready" : i.rationale ? "Design rationale ready" : i.discovery?.concepts.length ? "Ideas ready" : "Started"} ·{" "}
          {new Date(i.updated_at).toLocaleDateString()}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={() => onOpen(i.id)}>
        Open
      </Button>
      <Button size="sm" variant="ghost" onClick={() => remove(i.id)} aria-label="Delete invention">
        <Trash2 />
      </Button>
    </li>
  );
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel>
        <h2 className="text-3xl">My Possibilities</h2>
        {saved.length ? (
          <ul className="mt-4 space-y-2">{saved.map((i) => <Row key={i.id} i={i} />)}</ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Blueprints you save appear here.</p>
        )}
      </Panel>
      {drafts.length > 0 && (
        <Panel>
          <h2 className="text-3xl">In progress</h2>
          <ul className="mt-4 space-y-2">{drafts.slice(0, 8).map((i) => <Row key={i.id} i={i} />)}</ul>
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------ invention ------------------------------ */

type Stage = "questions" | "ideas" | "customize" | "rationale" | "final";

function deriveStage(inv: Invention): Stage {
  if (inv.blueprint) return "final";
  if (inv.rationale) return "rationale";
  if (inv.discovery?.follow_up_questions.length && !inv.discovery.concepts.length) return "questions";
  return "ideas";
}

const STAGES: { key: Stage; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "customize", label: "Customize" },
  { key: "rationale", label: "Why it's yours" },
  { key: "final", label: "Made for You" },
];

function InventionView({ workspaceId, inv, set, onNew }: { workspaceId: string; inv: Invention; set: (i: Invention) => void; onNew: () => void }) {
  const [stage, setStage] = useState<Stage>(deriveStage(inv));
  const [chosen, setChosen] = useState<ToolConcept | null>(inv.selected);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [stage]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onNew}>
          <ArrowLeft /> All possibilities
        </Button>
        {stage !== "questions" && (
          <ol className="flex flex-wrap gap-1 text-xs" aria-label="Progress">
            {STAGES.map((s, i) => (
              <li
                key={s.key}
                aria-current={stage === s.key ? "step" : undefined}
                className={cn("rounded-full px-3 py-1", stage === s.key ? "bg-accent/60 text-foreground" : "text-muted-foreground")}
              >
                {i + 1}. {s.label}
              </li>
            ))}
          </ol>
        )}
      </div>
      {stage === "questions" && <Questions workspaceId={workspaceId} inv={inv} onDone={(i) => { set(i); setStage("ideas"); }} />}
      {stage === "ideas" && (
        <Ideas
          workspaceId={workspaceId}
          inv={inv}
          set={set}
          chosen={chosen}
          onChoose={(c) => {
            setChosen(c);
            setStage("customize");
          }}
        />
      )}
      {stage === "customize" && chosen && (
        <Customize workspaceId={workspaceId} inv={inv} concept={chosen} onBack={() => setStage("ideas")} onDone={(i) => { set(i); setStage("rationale"); }} />
      )}
      {stage === "rationale" && inv.rationale && (
        <RationaleStep workspaceId={workspaceId} inv={inv} onBack={() => setStage("customize")} onDone={(i) => { set(i); setStage("final"); }} />
      )}
      {stage === "final" && inv.blueprint && (
        <Final workspaceId={workspaceId} inv={inv} set={set} onRefine={() => setStage("customize")} onNew={onNew} />
      )}
    </div>
  );
}

function Questions({ workspaceId, inv, onDone }: { workspaceId: string; inv: Invention; onDone: (i: Invention) => void }) {
  const qs = inv.discovery?.follow_up_questions ?? [];
  const [answers, setAnswers] = useState<string[]>(qs.map(() => ""));
  const { busy, run } = useBusy();
  const go = async (skip: boolean) => {
    const res = await run(() =>
      answerFollowUps({ data: { id: workspaceId, inventionId: inv.id, answers: qs.map((q, i) => ({ question: q, answer: skip ? "" : answers[i] })) } }),
    );
    if (res) onDone(res);
  };
  return (
    <Panel className="mx-auto max-w-3xl">
      <p className="eyebrow">A few quick questions</p>
      <h2 className="mt-2 text-4xl">To make this genuinely yours</h2>
      <p className="mt-2 text-sm text-muted-foreground">Answer any you like. Skip anything you'd rather not share.</p>
      <div className="mt-6 space-y-5">
        {qs.map((q, i) => (
          <div key={q}>
            <Label htmlFor={`mfm-q${i}`}>{q}</Label>
            <Textarea id={`mfm-q${i}`} className="mt-2" rows={2} maxLength={800} value={answers[i]} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => go(false)} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Show me my three tools
        </Button>
        <Button variant="ghost" onClick={() => go(true)} disabled={busy}>
          Skip questions
        </Button>
      </div>
      {busy && <p className="mt-3 text-sm text-muted-foreground" role="status">Designing three tools for you…</p>}
    </Panel>
  );
}

function Ideas({ workspaceId, inv, set, chosen, onChoose }: { workspaceId: string; inv: Invention; set: (i: Invention) => void; chosen: ToolConcept | null; onChoose: (c: ToolConcept) => void }) {
  const d = inv.discovery;
  const [rejectedNeeds, setRejectedNeeds] = useState<string[]>([]);
  const { busy, run } = useBusy();
  if (!d) return null;
  const refresh = async () => {
    const res = await run(() => refreshConcepts({ data: { id: workspaceId, inventionId: inv.id, rejectedNeedIds: rejectedNeeds } }));
    if (res) {
      set(res);
      setRejectedNeeds([]);
    }
  };
  const reject = async (c: ToolConcept) => {
    const res = await run(() => rejectConcept({ data: { id: workspaceId, inventionId: inv.id, conceptId: c.id } }));
    if (res) set(res);
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Three inventions, designed around you</p>
          <h2 className="mt-2 text-4xl md:text-5xl">Tools that don't exist yet</h2>
        </div>
        <SourceBadge source={d.source} model={d.model} />
      </div>

      {d.inferred_needs.length > 0 && (
        <Panel>
          <h3 className="text-2xl">What I think you might need</h3>
          <p className="mt-1 text-sm text-muted-foreground">Tap any that are wrong — they'll be avoided when you ask for new ideas.</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {d.inferred_needs.map((n) => {
              const off = rejectedNeeds.includes(n.id);
              return (
                <li key={n.id} className={cn("rounded-2xl border border-border/60 p-4", off && "opacity-50")}>
                  <div className="flex items-start gap-2">
                    <p className={cn("flex-1 text-sm", off && "line-through")}>{n.need}</p>
                    <Badge variant={n.basis === "stated" ? "evidence" : "hypothesis"}>{n.basis === "stated" ? "From your words" : "AI hypothesis"}</Badge>
                  </div>
                  <EvidenceList ids={n.evidence_ids} evidence={d.evidence} className="mt-2" />
                  <Button size="sm" variant="ghost" className="mt-2" aria-pressed={off} onClick={() => setRejectedNeeds(off ? rejectedNeeds.filter((x) => x !== n.id) : [...rejectedNeeds, n.id])}>
                    {off ? "Undo" : "That's not me"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {d.concepts.length ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {d.concepts.map((c, i) => (
            <ConceptCard key={c.id} concept={c} index={i} evidence={d.evidence} selected={chosen?.id === c.id} onSelect={() => onChoose(c)} onReject={() => reject(c)} disabled={busy} />
          ))}
        </div>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">You've set aside every idea. Ask for three new ones below.</p>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={refresh} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Show me three different ideas
        </Button>
        {busy && <span className="text-sm text-muted-foreground" role="status">Muse Spark is imagining new tools…</span>}
        {inv.rejected.length > 0 && <span className="text-xs text-muted-foreground">Set aside so far: {inv.rejected.join(", ")}</span>}
      </div>
    </div>
  );
}

function Customize({ workspaceId, inv, concept, onBack, onDone }: { workspaceId: string; inv: Invention; concept: ToolConcept; onBack: () => void; onDone: (i: Invention) => void }) {
  const prev = inv.selected?.id === concept.id ? inv.customization : null;
  const [outcome, setOutcome] = useState(prev?.outcome ?? concept.what_becomes_possible);
  const [assumptions, setAssumptions] = useState<Customization["assumptions"]>(
    prev?.assumptions ?? concept.assumptions.map((text) => ({ text, status: "unreviewed" as const, correction: "" })),
  );
  const [prefs, setPrefs] = useState<PreferenceKey[]>(prev?.preferences ?? []);
  const [custom, setCustom] = useState(prev?.custom_instructions ?? "");
  const [builder, setBuilder] = useState<Builder>(prev?.builder ?? "lovable");
  const { busy, run } = useBusy();

  const go = async () => {
    if (outcome.trim().length < 3) {
      toast.error("Describe what you'd like this tool to make possible.");
      return;
    }
    const res = await run(() =>
      designForMe({
        data: {
          id: workspaceId,
          inventionId: inv.id,
          conceptId: concept.id,
          customization: { outcome, assumptions, preferences: prefs, custom_instructions: custom, builder },
        },
      }),
    );
    if (res) onDone(res);
  };

  const setA = (i: number, patch: Partial<Customization["assumptions"][number]>) => setAssumptions(assumptions.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
        <Panel>
          <p className="eyebrow">Your chosen invention</p>
          <h2 className="mt-2 text-4xl">{concept.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{concept.what_it_does}</p>
          <Label htmlFor="mfm-outcome" className="mt-6 block">
            What should this tool make easier or possible for you?
          </Label>
          <Textarea id="mfm-outcome" className="mt-2" rows={3} maxLength={600} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </Panel>
        {assumptions.length > 0 && (
          <Panel>
            <h3 className="text-2xl">Check my assumptions</h3>
            <ul className="mt-4 space-y-4">
              {assumptions.map((a, i) => (
                <li key={a.text} className="rounded-2xl border border-border/60 p-4">
                  <p className={cn("text-sm", a.status === "rejected" && "line-through opacity-60")}>{a.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Is this right?">
                    {(["confirmed", "corrected", "rejected"] as const).map((s) => (
                      <Button key={s} size="sm" variant={a.status === s ? "default" : "ghost"} aria-pressed={a.status === s} onClick={() => setA(i, { status: a.status === s ? "unreviewed" : s })}>
                        {s === "confirmed" ? "That's right" : s === "corrected" ? "Correct it" : "Not true"}
                      </Button>
                    ))}
                  </div>
                  {a.status === "corrected" && (
                    <Input aria-label="Your correction" className="mt-2" maxLength={300} value={a.correction} onChange={(e) => setA(i, { correction: e.target.value })} placeholder="What's actually true?" />
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
      <div className="space-y-6">
        <Panel>
          <PreferencesPanel value={prefs} onChange={setPrefs} custom={custom} onCustom={setCustom} />
        </Panel>
        <Panel>
          <h3 className="text-2xl">Where will you build it?</h3>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">Your build prompt is written for this builder.</p>
          <BuilderPicker value={builder} onChange={setBuilder} />
        </Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            <ArrowLeft /> Back to ideas
          </Button>
          <Button size="lg" onClick={go} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Design it for me
          </Button>
        </div>
        {busy && <p className="text-sm text-muted-foreground" role="status">Explaining every design choice… about 20 seconds.</p>}
      </div>
    </div>
  );
}

type ReviewDetail = ApprovedDetail & { include: boolean; label: string };

function RationaleStep({ workspaceId, inv, onBack, onDone }: { workspaceId: string; inv: Invention; onBack: () => void; onDone: (i: Invention) => void }) {
  const r = inv.rationale!;
  const evidence = useMemo(
    () => [
      ...(inv.discovery?.evidence ?? []),
      ...preferenceEvidence(inv.customization?.preferences ?? [], inv.customization?.custom_instructions ?? ""),
    ],
    [inv],
  );
  const [decisionIds, setDecisionIds] = useState<string[]>(r.decisions.map((d) => d.id));
  const [details, setDetails] = useState<ReviewDetail[]>(() => {
    const ids = new Set([...(inv.selected?.evidence_ids ?? []), ...r.decisions.flatMap((d) => d.evidence_ids)]);
    return (inv.discovery?.evidence ?? [])
      .filter((e) => ids.has(e.id) && !e.id.startsWith("p:"))
      .map((e) => ({ id: e.id, text: e.text, label: e.label, include: e.kind !== "hypothesis" }));
  });
  const { busy, run } = useBusy();
  const go = async () => {
    const res = await run(() =>
      buildBlueprint({
        data: {
          id: workspaceId,
          inventionId: inv.id,
          approved: details.filter((d) => d.include && d.text.trim()).map(({ id, text }) => ({ id, text })),
          decisionIds,
        },
      }),
    );
    if (res) onDone(res);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">{inv.selected?.name}</p>
          <SourceBadge source={r.source} model={r.model} />
        </div>
        <h2 className="mt-2 text-4xl md:text-5xl">Why I Designed This for You</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Each decision shows what it's based on: <span className="text-gold">things you told us</span>,{" "}
          <span className="text-pearl">your chosen preferences</span>, or <span className="text-lavender">AI hypotheses</span> you can untick.
        </p>
        <div className="mt-6">
          <RationaleView rationale={r} evidence={evidence} included={decisionIds} onToggle={(id) => setDecisionIds(decisionIds.includes(id) ? decisionIds.filter((x) => x !== id) : [...decisionIds, id])} />
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel>
          <DetailsReview details={details} onChange={setDetails} />
        </Panel>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            <Pencil /> Change preferences
          </Button>
          <Button size="lg" onClick={go} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />} Generate my blueprint
          </Button>
        </div>
        {busy && <p className="text-sm text-muted-foreground" role="status">Writing your full build blueprint… this can take up to a minute.</p>}
      </div>
    </div>
  );
}

function Final({ workspaceId, inv, set, onRefine, onNew }: { workspaceId: string; inv: Invention; set: (i: Invention) => void; onRefine: () => void; onNew: () => void }) {
  const b = inv.blueprint!;
  const [prompt, setPrompt] = useState(b.build_prompt);
  const dirty = prompt !== b.build_prompt;
  const saveBusy = useBusy();
  const evidence = inv.discovery?.evidence ?? [];
  const persist = async (patch: { saved?: boolean; build_prompt?: string }) => {
    const res = await saveBusy.run(() => updateInvention({ data: { id: workspaceId, inventionId: inv.id, ...patch } }));
    if (res) set(res);
    return res;
  };
  const current = { ...b, build_prompt: prompt };

  return (
    <div className="space-y-8">
      <article className="glass relative overflow-hidden rounded-[2rem] p-6 md:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">A personal invention document</p>
          <SourceBadge source={b.source} model={b.model} />
        </div>
        <h2 className="mt-4 text-6xl md:text-7xl">
          Made for <em className="text-gold-gradient">You.</em>
        </h2>
        <p className="mt-6 font-display text-4xl">{b.tool_name}</p>
        <p className="mt-3 max-w-3xl text-muted-foreground">{b.purpose}</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-2">Intended personal benefit</p>
            <p className="text-sm">{b.intended_benefit}</p>
          </div>
          <div>
            <p className="eyebrow mb-2">Accessibility preferences</p>
            <PrefList prefs={b.preferences} />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <PromptActions prompt={prompt} onDownload={() => downloadBlueprint(current, inv.rationale, evidence, inv.approved_details)} />
          <Button variant="outline" onClick={onRefine}>
            <Pencil /> Refine My Tool
          </Button>
          <Button variant="outline" onClick={() => persist({ saved: !inv.saved })} disabled={saveBusy.busy} aria-pressed={inv.saved}>
            {inv.saved ? <BookmarkCheck /> : <Bookmark />} {inv.saved ? "Saved to My Possibilities" : "Save to My Possibilities"}
          </Button>
          <Button variant="ghost" onClick={onNew}>
            <Plus /> Create Another Tool
          </Button>
        </div>

        {inv.rationale && (
          <section className="mt-12">
            <h3 className="text-3xl">Why I designed this for you</h3>
            <div className="mt-4">
              <RationaleView rationale={{ ...inv.rationale, decisions: inv.rationale.decisions.filter((d) => b.design_decisions.some((x) => x.decision === d.decision)) }} evidence={evidence} />
            </div>
          </section>
        )}

        <div className="mt-12">
          <BlueprintSections b={b} />
        </div>

        <section className="mt-12 border-t border-border/50 pt-6">
          <h3 className="flex items-baseline gap-3 text-2xl">
            <span className="font-display text-gold">J</span> Copy-ready build prompt
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review it before pasting — this is exactly what you'll share. Only the personal details you approved are in it. You can edit it here.
          </p>
          <Textarea aria-label="Build prompt" className="mt-3 min-h-[24rem] font-mono text-xs" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <PromptActions prompt={prompt} onDownload={() => downloadBlueprint(current, inv.rationale, evidence, inv.approved_details)} />
            {dirty && (
              <>
                <Button variant="outline" onClick={() => persist({ build_prompt: prompt })} disabled={saveBusy.busy}>
                  Save my edits
                </Button>
                <Button variant="ghost" onClick={() => setPrompt(b.build_prompt)}>
                  Undo edits
                </Button>
              </>
            )}
          </div>
        </section>
        <p className="mt-10 text-xs text-muted-foreground">
          A blueprint is a plan, not proof. Nothing here shows the tool works or is accessible until you build and try it.
        </p>
      </article>

      <Feedback workspaceId={workspaceId} inv={inv} set={set} />
    </div>
  );
}

function Feedback({ workspaceId, inv, set }: { workspaceId: string; inv: Invention; set: (i: Invention) => void }) {
  const f = inv.feedback;
  const [open, setOpen] = useState(false);
  const [built, setBuilt] = useState<InventionFeedback["built"]>(f?.built ?? "yes");
  const [used, setUsed] = useState<InventionFeedback["used"]>(f?.used ?? "yes");
  const [helped, setHelped] = useState<InventionFeedback["helped"]>(f?.helped ?? "too_early");
  const [worked, setWorked] = useState(f?.worked ?? "");
  const [didnt, setDidnt] = useState(f?.didnt_work ?? "");
  const [change, setChange] = useState(f?.change ?? "");
  const { busy, run } = useBusy();
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run(() =>
      submitInventionFeedback({ data: { id: workspaceId, inventionId: inv.id, feedback: { built, used, helped, worked, didnt_work: didnt, change } } }),
    );
    if (res) {
      set(res);
      setOpen(false);
    }
  };
  const Choice = <T extends string>({ label, value, onChange, opts }: { label: string; value: T; onChange: (v: T) => void; opts: [T, string][] }) => (
    <div>
      <p className="text-sm">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {opts.map(([v, l]) => (
          <Button key={v} type="button" size="sm" role="radio" aria-checked={value === v} variant={value === v ? "default" : "outline"} onClick={() => onChange(v)}>
            {l}
          </Button>
        ))}
      </div>
    </div>
  );
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-3xl">Tried it? Tell me how it went</h3>
          <p className="mt-1 text-sm text-muted-foreground">Optional. Your answers are self-reported — Latentora can't measure whether the tool helped, only suggest improvements.</p>
        </div>
        {!open && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {f ? "Update feedback" : "Give feedback"}
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={go} className="mt-6 grid gap-5 md:grid-cols-2">
          <Choice label="Did you build it?" value={built} onChange={setBuilt} opts={[["yes", "Yes"], ["partly", "Partly"], ["no", "Not yet"]]} />
          <Choice label="Have you used it?" value={used} onChange={setUsed} opts={[["yes", "Yes"], ["a_little", "A little"], ["no", "No"]]} />
          <Choice label="Did it help with what you wanted?" value={helped} onChange={setHelped} opts={[["yes", "Yes"], ["somewhat", "Somewhat"], ["no", "No"], ["too_early", "Too early to say"]]} />
          <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="fb-w">What worked?</Label>
              <Textarea id="fb-w" className="mt-2" rows={3} maxLength={1000} value={worked} onChange={(e) => setWorked(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fb-d">What didn't?</Label>
              <Textarea id="fb-d" className="mt-2" rows={3} maxLength={1000} value={didnt} onChange={(e) => setDidnt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fb-c">What would you change?</Label>
              <Textarea id="fb-c" className="mt-2" rows={3} maxLength={1000} value={change} onChange={(e) => setChange(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest revisions
            </Button>
            {busy && <span role="status" className="text-sm text-muted-foreground">Reading your feedback…</span>}
          </div>
        </form>
      )}
      {f && !open && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 p-4 text-sm">
            <Badge variant="sample">Self-reported by you</Badge>
            <p className="mt-2 text-muted-foreground">
              Built: {f.built} · Used: {f.used.replace("_", " ")} · Helped: {f.helped.replace("_", " ")}
            </p>
            {f.worked && <p className="mt-1">Worked: {f.worked}</p>}
            {f.didnt_work && <p className="mt-1">Didn't: {f.didnt_work}</p>}
            {f.change && <p className="mt-1">Change: {f.change}</p>}
          </div>
          {inv.revision ? (
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-2xl">Suggested revisions</h4>
                <SourceBadge source={inv.revision.source} model={inv.revision.model} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{inv.revision.summary}</p>
              <ul className="mt-3 space-y-3 text-sm">
                {inv.revision.changes.map((c) => (
                  <li key={c.change} className="rounded-2xl border border-border/60 p-3">
                    <span className="text-xs uppercase tracking-widest text-lavender">{c.section}</span>
                    <p className="mt-1">{c.change}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Because you said: “{c.because_you_said}”</p>
                  </li>
                ))}
              </ul>
              {inv.revision.keep.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Keep: {inv.revision.keep.join(" · ")}</p>}
              <p className="mt-3 text-xs text-muted-foreground">Use "Refine My Tool" to apply these and regenerate your blueprint.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Feedback saved. Revisions couldn't be generated yet — try again.</p>
          )}
        </div>
      )}
    </Panel>
  );
}
