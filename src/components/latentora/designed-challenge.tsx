import { Camera, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, SourceBadge, resizeImage, useBusy } from "@/components/latentora/shared";
import { deleteChallenge, generateChallenge, submitCustomExperiment } from "@/lib/latentora.functions";
import { scoreCustomChallenge } from "@/lib/challenge-rules";
import type { Challenge, WorkspaceData } from "@/lib/types";

/** Lets the user pick a capability and have Muse Spark design a measurable challenge for it. */
export function ChallengeDesigner({
  ws,
  id,
  onCreated,
}: {
  ws: WorkspaceData;
  id: string;
  onCreated: (challengeId: string) => void;
}) {
  const caps = ws.analysis?.result.capabilities ?? [];
  // Hypothesised capabilities first: they're the ones that most need evidence.
  const ordered = [...caps].sort((a, b) => (a.status === b.status ? 0 : a.status === "hypothesized" ? -1 : 1));
  const [capability, setCapability] = useState(ordered[0]?.name ?? "");
  const [custom, setCustom] = useState("");
  const [context, setContext] = useState("");
  const { busy, run } = useBusy();

  const target = (custom.trim() || capability).trim();
  const design = async () => {
    if (target.length < 2) {
      toast.error("Choose or type a capability to test.");
      return;
    }
    const r = await run(() => generateChallenge({ data: { id, capability: target, context } }));
    if (r) {
      toast.success("Muse Spark designed a new challenge.");
      onCreated(r.challengeId);
    }
  };

  return (
    <Panel>
      <p className="eyebrow">Design a challenge</p>
      <h2 className="mt-2 text-3xl">Test a different ability</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Muse Spark proposes a small at-home task with numbers you can measure. Your result is then scored by fixed rules — you
        see every target before you start.
      </p>
      {ordered.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Capability to test">
          {ordered.map((c) => (
            <button
              key={c.name}
              role="radio"
              aria-checked={!custom && capability === c.name}
              onClick={() => {
                setCapability(c.name);
                setCustom("");
              }}
              className={
                !custom && capability === c.name
                  ? "rounded-full border border-gold bg-gold/10 px-3 py-1 text-xs"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-gold/40"
              }
            >
              {c.name}
              {c.status === "hypothesized" && <span className="ml-1 text-lavender">· untested hunch</span>}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cap-custom">{ordered.length ? "Or type another ability" : "Ability to test"}</Label>
          <Input id="cap-custom" maxLength={120} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Clear written instructions" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cap-context">Anything to keep in mind? (optional)</Label>
          <Input id="cap-context" maxLength={300} value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g. 20 minutes, only a kitchen" />
        </div>
      </div>
      <Button className="mt-5" disabled={busy || target.length < 2} onClick={design}>
        {busy ? (
          <>
            <Loader2 className="animate-spin" /> Muse Spark is designing…
          </>
        ) : (
          <>
            <Wand2 /> Design a challenge for “{target || "…"}”
          </>
        )}
      </Button>
    </Panel>
  );
}

const PHOTO_CHECK = "The finished result is visible in my photo";
const MANUAL_CHECKS = [PHOTO_CHECK, "I followed every step as written", "I measured the numbers myself, not estimated", "I did it in one sitting"];

export function DesignedChallengeLab({
  challenge,
  id,
  refresh,
  onDeleted,
}: {
  challenge: Challenge;
  id: string;
  refresh: () => void;
  onDeleted: () => void;
}) {
  const spec = challenge.spec;
  const [values, setValues] = useState<Record<string, string>>({});
  const [reflection, setReflection] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, run } = useBusy();

  const numeric = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)))
      .map(([k, v]) => [k, Number(v)]),
  );
  const preview = scoreCustomChallenge(spec, { values: numeric, reflection });

  const submit = async () => {
    if (Object.keys(numeric).length === 0) {
      toast.error("Enter at least one measurement.");
      return;
    }
    const r = await run(() =>
      submitCustomExperiment({ data: { id, challengeId: challenge.id, values: numeric, reflection, photoDataUrl: photo, manualChecks: checks } }),
    );
    if (r) {
      if (r.notice) toast.warning(r.notice);
      else toast.success(r.evidence_mode === "sam" ? "Scored, and SAM 3.1 analysed your photo." : "Scored with your measurements.");
      setValues({});
      setReflection("");
      setPhoto(null);
      setChecks([]);
      refresh();
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">Tests · {spec.capability}</p>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete this challenge"
            onClick={async () => {
              if (!confirm("Delete this challenge? Past results stay in your history.")) return;
              await deleteChallenge({ data: { id, challengeId: challenge.id } });
              onDeleted();
              refresh();
            }}
          >
            <Trash2 />
          </Button>
        </div>
        <h2 className="mt-2 text-4xl">{spec.title}</h2>
        <div className="mt-2">
          <SourceBadge source={challenge.source} model={challenge.model} />
        </div>
        {spec.why && <p className="mt-3 text-sm text-muted-foreground">{spec.why}</p>}
        <p className="mt-3 text-xs text-muted-foreground">About {spec.duration_minutes} minutes</p>
        {spec.materials.length > 0 && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">You'll need: </span>
            {spec.materials.join(", ")}
          </p>
        )}
        <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
          {spec.steps.map((s, i) => (
            <li key={i}>
              <span className="mr-2 text-gold">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
        {spec.safety_note && <p className="mt-4 text-xs text-warning">{spec.safety_note}</p>}
        <p className="mt-4 rounded-2xl border border-border p-3 text-xs text-muted-foreground">
          Muse Spark wrote this task and its targets. Your score is a plain comparison of your numbers against the targets below —
          no AI judges your result.
        </p>
      </Panel>

      <Panel>
        <h2 className="text-3xl">Record your result</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {spec.measures.map((m) => (
            <div key={m.id} className="space-y-1.5">
              <Label htmlFor={`m-${m.id}`}>
                {m.label} ({m.unit})
              </Label>
              <Input
                id={`m-${m.id}`}
                type="number"
                min={0}
                inputMode="decimal"
                value={values[m.id] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [m.id]: e.target.value }))}
                placeholder="0"
              />
              <p className="text-[0.7rem] text-muted-foreground">
                Target {m.direction === "at_least" ? "≥" : "≤"} {m.target} {m.unit}
                {m.how_to_measure ? ` · ${m.how_to_measure}` : ""}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="d-reflection">What did you notice or change along the way?</Label>
          <Textarea id="d-reflection" rows={2} maxLength={1500} value={reflection} onChange={(e) => setReflection(e.target.value)} />
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
                e.target.value = "";
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
              className="grid size-28 place-items-center overflow-hidden rounded-2xl border border-dashed border-gold/40 text-xs text-muted-foreground hover:border-gold"
            >
              {photo ? (
                <img src={photo} alt="Your result" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1">
                  <Camera className="size-5 text-gold" /> Upload photo
                </span>
              )}
            </button>
            {photo && (
              <button
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setPhoto(null);
                  setChecks((p) => p.filter((x) => x !== PHOTO_CHECK));
                }}
              >
                Remove photo
              </button>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {photo && spec.photo_subject
                ? `SAM 3.1 will look for “${spec.photo_subject}” in your photo. It reports what it sees — it doesn't change your score.`
                : photo
                  ? "Your photo is saved with the result. This challenge has nothing SAM 3.1 can check in a photo."
                  : "A photo is optional. Without one, just tick what's true below — it's saved as self-reported."}
            </p>
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
            Preview: <span className="text-gold">{preview.met_count} / {spec.measures.length}</span> targets met
          </p>
          <Button size="lg" disabled={busy} onClick={submit}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> Scoring…
              </>
            ) : (
              <>
                <Sparkles /> Submit result
              </>
            )}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
