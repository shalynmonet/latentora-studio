import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageIntro, Panel, WorkspaceGate, useBusy } from "@/components/latentora/shared";
import { submitExperiment } from "@/lib/latentora.functions";
import { PAPER_RULES, scorePaperChallenge } from "@/lib/scoring";
import type { CriterionStatus, Experiment, PaperChallengeInputs, SegmentationEvidence, WorkspaceData } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/experiment")({
  head: () => ({
    meta: [
      { title: "Experiment — Proof Lab · Latentora" },
      { name: "description", content: "Test transferable abilities with the Paper Structure Challenge, scored by rules and observed by SAM 3.1." },
      { property: "og:title", content: "Experiment — Proof Lab · Latentora" },
      { property: "og:description", content: "Small, measurable challenges that turn hunches into evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExperimentPage,
});

const PHOTO_CHECK = "The whole structure is visible in my photo";
const MANUAL_CHECKS = [
  PHOTO_CHECK,
  "The load is resting on top of the structure",
  "Only paper and tape were used",
  "The structure stood on its own (not leaning on anything)",
];

function ExperimentPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro
        step={4}
        title={
          <>
            Turn a hunch into <em className="text-gold-gradient">evidence</em>
          </>
        }
        sub="The Paper Structure Challenge tests structural reasoning, resource efficiency and iterative prototyping. Your measurements are scored by fixed rules; SAM 3.1 only reports what it can see in your photo."
      />
      <WorkspaceGate>{(ws, refresh, id) => <Lab ws={ws} refresh={refresh} id={id} />}</WorkspaceGate>
    </div>
  );
}

const EMPTY: PaperChallengeInputs = {
  sheets_used: 0,
  tape_cm: 0,
  height_cm: 0,
  load_g: 0,
  hold_seconds: 0,
  iterations: 0,
  build_minutes: 0,
  reflection: "",
};

async function resizeImage(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Lab({ ws, refresh, id }: { ws: WorkspaceData; refresh: () => void; id: string }) {
  const [inputs, setInputs] = useState<PaperChallengeInputs>(EMPTY);
  const [photo, setPhoto] = useState<string | null>(null);
  const [structurePrompt, setStructurePrompt] = useState("paper tower");
  const [loadPrompt, setLoadPrompt] = useState("book");
  const [checks, setChecks] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, run } = useBusy();
  const preview = scorePaperChallenge(inputs);

  const set = (k: keyof PaperChallengeInputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInputs((p) => ({ ...p, [k]: k === "reflection" ? e.target.value : Number(e.target.value) }));

  const submit = async () => {
    if (inputs.sheets_used <= 0 || inputs.height_cm <= 0) {
      toast.error("Enter at least the sheets used and the height.");
      return;
    }
    const r = await run(() =>
      submitExperiment({
        data: { id, inputs, photoDataUrl: photo, structurePrompt, loadPrompt: loadPrompt || null, manualChecks: checks },
      }),
    );
    if (r) {
      if (r.notice) toast.warning(r.notice);
      else toast.success(r.evidence_mode === "sam" ? "Scored, and SAM 3.1 analysed your photo." : "Scored with your manual evidence.");
      setInputs(EMPTY);
      setPhoto(null);
      setChecks([]);
      refresh();
    }
  };

  const numField = (k: keyof PaperChallengeInputs, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type="number" min={0} inputMode="decimal" value={inputs[k] === 0 ? "" : (inputs[k] as number)} onChange={set(k)} placeholder="0" />
      {hint && <p className="text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <Panel>
          <p className="eyebrow">The challenge</p>
          <h2 className="mt-2 text-4xl">Paper Structure</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>✦ Up to {PAPER_RULES.maxSheets} sheets of A4 / Letter paper and {PAPER_RULES.maxTapeCm} cm of tape. Nothing else.</li>
            <li>✦ Build the tallest freestanding structure you can.</li>
            <li>✦ Place a load on top (a book works) and time how long it holds. Target: {PAPER_RULES.holdTargetSeconds} s.</li>
            <li>✦ Weigh the load on a kitchen scale. Measure height with a ruler.</li>
            <li>✦ Build more than one prototype — iteration counts.</li>
            <li>✦ Photograph the final structure with the load on it.</li>
          </ul>
          <p className="mt-4 rounded-2xl border border-border p-3 text-xs text-muted-foreground">
            Scoring is deterministic: your numbers are compared to fixed targets. A photo can show shape and placement — it
            cannot prove weight or strength.
          </p>
        </Panel>

        <Panel>
          <h2 className="text-3xl">Record your result</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {numField("sheets_used", "Sheets used")}
            {numField("tape_cm", "Tape (cm)")}
            {numField("height_cm", "Height (cm)")}
            {numField("load_g", "Load (g)")}
            {numField("hold_seconds", "Held for (s)")}
            {numField("iterations", "Prototypes")}
            {numField("build_minutes", "Build time (min)")}
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="reflection">What did you change between prototypes?</Label>
            <Textarea id="reflection" rows={2} maxLength={1500} value={inputs.reflection} onChange={set("reflection")} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[auto_1fr]">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setPhoto(await resizeImage(f));
                  } catch {
                    toast.error("Couldn't read that image.");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid size-36 place-items-center overflow-hidden rounded-2xl border border-dashed border-border text-xs text-muted-foreground hover:border-gold/50"
              >
                {photo ? (
                  <img src={photo} alt="Your structure" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2">
                    <Camera className="size-5 text-gold" /> Upload photo
                  </span>
                )}
              </button>
              {photo && (
                <button className="mt-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setPhoto(null)}>
                  Remove photo
                </button>
              )}
            </div>
            <div className="space-y-3">
              {photo ? (
                <>
                  <p className="text-xs text-muted-foreground">SAM 3.1 will look for these in your photo:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sp">Structure</Label>
                      <Input id="sp" value={structurePrompt} maxLength={60} onChange={(e) => setStructurePrompt(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lp">Load</Label>
                      <Input id="lp" value={loadPrompt} maxLength={60} onChange={(e) => setLoadPrompt(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A photo is optional. Without one, just tick what's true below — it's saved as self-reported.
                </p>
              )}
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs text-muted-foreground">Tick what's true (optional, self-reported)</legend>
                {MANUAL_CHECKS.filter((c) => photo || c !== PHOTO_CHECK).map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={checks.includes(c)} onCheckedChange={(v) => setChecks((p) => (v ? [...p, c] : p.filter((x) => x !== c)))} />
                    {c}
                  </label>
                ))}
              </fieldset>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">
              Preview: <span className="text-gold">{preview.met_count} / 5</span> criteria met
            </p>
            <Button size="lg" disabled={busy} onClick={submit}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" /> {photo ? "Scoring & analysing photo…" : "Scoring…"}
                </>
              ) : (
                "Submit result"
              )}
            </Button>
          </div>
        </Panel>
      </div>

      <div>
        <h2 className="mb-5 text-4xl">Results</h2>
        {ws.experiments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempts yet. Your first result will update the Capability Atlas.</p>
        ) : (
          <div className="space-y-6">
            {ws.experiments.map((e) => (
              <ResultCard key={e.id} e={e} />
            ))}
            <Button asChild variant="outline">
              <Link to="/evolve">See how this changes your Atlas →</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_ICON: Record<CriterionStatus, React.ReactNode> = {
  met: <CheckCircle2 className="size-4 text-success" />,
  partial: <CircleDashed className="size-4 text-warning" />,
  not_met: <XCircle className="size-4 text-muted-foreground" />,
};
const VERDICT_LABEL = {
  supported: "Supported",
  partially_supported: "Partially supported",
  not_yet_supported: "Not yet supported",
};

function ResultCard({ e }: { e: Experiment }) {
  const seg = e.evidence_mode === "sam" ? (e.segmentation as SegmentationEvidence) : null;
  const manual = e.evidence_mode === "manual" ? (e.segmentation as { manual_checks: string[]; note?: string } | null) : null;
  return (
    <article className="glass grid gap-6 rounded-3xl p-6 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-2xl">Attempt · {new Date(e.created_at).toLocaleDateString()}</p>
          <Badge variant="tested">Rule-based score</Badge>
          {e.evidence_mode === "sam" ? <Badge variant="live">Live · sam-3.1</Badge> : <Badge variant="sample">Manual evidence · self-reported</Badge>}
        </div>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {e.score.criteria.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-2">{STATUS_ICON[c.status]}</td>
                <td className="py-2 pr-3">{c.label}</td>
                <td className="py-2 pr-3 text-muted-foreground">{c.measured}</td>
                <td className="py-2 text-xs text-muted-foreground">{c.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex flex-wrap gap-2">
          {e.score.capabilities.map((c) => (
            <span
              key={c.capability}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                c.verdict === "supported" ? "border-gold/50 text-gold" : c.verdict === "partially_supported" ? "border-lavender/50 text-lavender" : "border-border text-muted-foreground",
              )}
            >
              {c.capability}: {VERDICT_LABEL[c.verdict]}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {e.photo_url && <SegmentedPhoto url={e.photo_url} seg={seg} />}
        {seg && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {seg.observations.map((o, i) => (
              <li key={i}>· {o}</li>
            ))}
          </ul>
        )}
        {manual && (
          <div className="text-xs text-muted-foreground">
            {manual.note && <p className="mb-1 text-warning">{manual.note}</p>}
            <p className="mb-1">Self-reported checks:</p>
            {manual.manual_checks.length ? manual.manual_checks.map((c) => <p key={c}>✓ {c}</p>) : <p>None ticked.</p>}
          </div>
        )}
      </div>
    </article>
  );
}

function SegmentedPhoto({ url, seg }: { url: string; seg: SegmentationEvidence | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <img src={url} alt="Submitted structure" className="w-full" loading="lazy" />
      {seg &&
        [...seg.structure_boxes.map((b) => ({ b, kind: "s" })), ...seg.load_boxes.map((b) => ({ b, kind: "l" }))].map(({ b, kind }, i) => (
          <div
            key={i}
            className={cn("absolute rounded-md border-2", kind === "s" ? "border-gold" : "border-lavender")}
            style={{
              left: `${(b.x1 / b.w) * 100}%`,
              top: `${(b.y1 / b.h) * 100}%`,
              width: `${((b.x2 - b.x1) / b.w) * 100}%`,
              height: `${((b.y2 - b.y1) / b.h) * 100}%`,
            }}
          >
            <span className={cn("absolute -top-5 left-0 rounded px-1 text-[0.6rem]", kind === "s" ? "bg-gold text-gold-foreground" : "bg-lavender text-gold-foreground")}>
              {kind === "s" ? seg.structure_prompt : seg.load_prompt}
            </span>
          </div>
        ))}
    </div>
  );
}
