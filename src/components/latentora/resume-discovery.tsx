import { Check, FileText, Loader2, Pencil, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Panel, SourceBadge, useBusy } from "@/components/latentora/shared";
import { readResumeFile, type ReadResume } from "@/lib/resume-extract";
import { analyzeResume, deleteResume, saveResumeReview } from "@/lib/resume.functions";
import type { ResumeClassification, ResumeDecision, ResumeFinding, ResumeRecord, WorkspaceData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ResumeDiscovery({ ws, refresh, id }: { ws: WorkspaceData; refresh: () => void; id: string }) {
  const [replacing, setReplacing] = useState(false);
  if (ws.resume && !replacing) return <BeyondTheResume resume={ws.resume} refresh={refresh} id={id} onReplace={() => setReplacing(true)} />;
  return (
    <ResumeUpload
      id={id}
      onCancel={ws.resume ? () => setReplacing(false) : undefined}
      onDone={() => {
        setReplacing(false);
        refresh();
      }}
    />
  );
}

/* ------------------------------ upload ------------------------------ */

function ResumeUpload({ id, onDone, onCancel }: { id: string; onDone: () => void; onCancel?: (() => void) | undefined }) {
  const [doc, setDoc] = useState<ReadResume | null>(null);
  const [consent, setConsent] = useState(false);
  const [reading, setReading] = useState(false);
  const analyze = useBusy();
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      setDoc(await readResumeFile(file));
    } catch (e) {
      setDoc(null);
      toast.error(e instanceof Error ? e.message : "Could not read that file");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };

  const reveal = async () => {
    if (!doc || !consent) return;
    const res = await analyze.run(() =>
      analyzeResume({ data: { id, consent: true, fileName: doc.fileName, kind: doc.kind, pdfDataUrl: doc.pdfDataUrl, text: doc.text } }),
    );
    if (res) {
      toast.success(`Muse Spark found ${res.findings} possible capabilities. Review them below.`);
      setDoc(null);
      setConsent(false);
      onDone();
    }
  };

  return (
    <Panel className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-plum/30 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <p className="eyebrow">Optional · Résumé</p>
          <h2 className="mt-2 text-4xl leading-tight">
            Your experience tells a <em className="text-gold-gradient">bigger story.</em>
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Upload your résumé to help Latentora uncover strengths, connections, and possibilities that traditional job titles might overlook.
          </p>
          <p className="mt-3 max-w-lg text-xs text-muted-foreground">
            This isn't a résumé makeover. Every capability Muse Spark suggests is tied to a quote from your document, and nothing joins your Atlas until you confirm it.
          </p>
        </div>

        <div className="space-y-4">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/40 bg-background/30 px-5 py-7 text-center transition hover:border-gold hover:bg-gold/5",
              analyze.busy && "pointer-events-none opacity-60",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files?.[0]);
            }}
          >
            {reading ? <Loader2 className="size-6 animate-spin text-gold" /> : doc ? <FileText className="size-6 text-gold" /> : <Upload className="size-6 text-gold" />}
            <span className="font-display text-xl">{doc ? doc.fileName : "Choose your résumé"}</span>
            <span className="text-xs text-muted-foreground">
              {doc
                ? doc.kind === "pdf"
                  ? doc.text
                    ? "PDF ready · quotes will be checked against its text"
                    : "PDF ready · its text layer couldn't be read, so quotes can't be checked automatically"
                  : "Word document ready"
                : "PDF or Word (.docx), up to 5 MB · drag it here or tap to browse"}
            </span>
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => void pick(e.target.files?.[0])}
              aria-label="Upload résumé (PDF or DOCX)"
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-border bg-background/30 p-3 text-xs text-muted-foreground">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-label="I consent to résumé analysis" />
            <span>
              <span className="text-foreground">I agree to send this résumé to Meta's Muse Spark for analysis.</span> Latentora doesn't keep the file or its
              full text, only the short quotes and findings, which you can delete at any time. Latentora never uses it for training, marketing or public
              sharing, and doesn't infer personal traits such as age, gender, ethnicity, religion or health.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={!doc || !consent || analyze.busy || reading} onClick={reveal}>
              {analyze.busy ? (
                <>
                  <Loader2 className="animate-spin" /> Muse Spark is reading your résumé…
                </>
              ) : (
                <>
                  <Sparkles /> Reveal My Hidden Capabilities
                </>
              )}
            </Button>
            {onCancel && (
              <Button variant="ghost" size="lg" onClick={onCancel} disabled={analyze.busy}>
                Cancel
              </Button>
            )}
          </div>
          {analyze.busy && <p className="text-xs text-muted-foreground">This usually takes 20–60 seconds.</p>}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------- Beyond the Résumé ------------------------ */

const GROUPS: { key: ResumeClassification; title: string; note: string; badge: "evidence" | "hypothesis" | "outline" }[] = [
  { key: "direct", title: "Directly supported", note: "Your résumé shows you doing this.", badge: "evidence" },
  { key: "hypothesis", title: "AI hypotheses", note: "A reasonable inference. Confirm only if it rings true.", badge: "hypothesis" },
  { key: "insufficient", title: "Not enough evidence", note: "Plausible, but your résumé doesn't show it yet.", badge: "outline" },
];

function BeyondTheResume({ resume, refresh, id, onReplace }: { resume: ResumeRecord; refresh: () => void; id: string; onReplace: () => void }) {
  const r = resume.result;
  const [review, setReview] = useState<Record<string, ResumeDecision>>(resume.review ?? {});
  useEffect(() => setReview(resume.review ?? {}), [resume.id, resume.reviewed_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useBusy();
  const del = useBusy();
  const passages = useMemo(() => new Map(r.passages.map((p) => [p.id, p])), [r.passages]);
  const dirty = JSON.stringify(review) !== JSON.stringify(resume.review ?? {});
  const confirmed = Object.values(review).filter((d) => d.decision === "confirmed").length;
  const saved = Object.values(resume.review ?? {}).filter((d) => d.decision === "confirmed").length;

  const set = (fid: string, d: ResumeDecision | null) =>
    setReview((prev) => {
      const next = { ...prev };
      if (d) next[fid] = d;
      else delete next[fid];
      return next;
    });

  const commit = async () => {
    const ok = await save.run(() => saveResumeReview({ data: { id, resumeId: resume.id, review } }));
    if (ok) {
      toast.success(confirmed ? `Your Capability Atlas now includes ${confirmed} résumé finding${confirmed === 1 ? "" : "s"}.` : "Saved. No résumé findings are in your Atlas.");
      refresh();
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this résumé analysis? Its quotes and findings will be removed from Latentora, including your Atlas.")) return;
    const ok = await del.run(() => deleteResume({ data: { id } }));
    if (ok) {
      toast.success("Résumé analysis deleted.");
      refresh();
    }
  };

  const p = r.profile;
  const hidden = r.findings.filter((f) => !f.named_in_resume && f.classification !== "insufficient").length;

  return (
    <div className="space-y-6">
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">Beyond the Résumé</p>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={resume.source} model={resume.model} />
              <Badge variant="outline" className="gap-1">
                <FileText className="size-3" /> {resume.file_name}
              </Badge>
            </div>
          </div>
          <h2 className="mt-3 max-w-3xl text-4xl leading-tight">{r.beyond.headline || "Your experience tells a bigger story."}</h2>
          {r.beyond.insight && <p className="mt-3 max-w-3xl text-muted-foreground">{r.beyond.insight}</p>}
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Stat n={r.findings.filter((f) => f.classification === "direct").length} label="directly supported" />
            <Stat n={r.findings.filter((f) => f.classification === "hypothesis").length} label="to confirm" />
            <Stat n={hidden} label="not named in your résumé" />
          </div>
          {r.beyond.connections.length > 0 && (
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {r.beyond.connections.map((c, i) => (
                <li key={i} className="rounded-2xl border border-border p-4 text-sm">
                  <span className="text-gold">{c.between.join(" ✦ ")}</span>
                  <p className="text-muted-foreground">{c.insight}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold" />
            {resume.quotes_checked
              ? "Every quote below was found word for word in your document. Quotes that didn't match were thrown out."
              : "This PDF's text couldn't be read in your browser, so the quotes weren't checked automatically. Please read them carefully before confirming."}{" "}
            The file itself wasn't kept.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onReplace}>
              <RotateCcw /> Use a different résumé
            </Button>
            <Button variant="ghost" size="sm" onClick={remove} disabled={del.busy} className="text-muted-foreground hover:text-destructive">
              {del.busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete résumé analysis
            </Button>
          </div>
        </div>
      </Panel>

      <details className="glass group rounded-3xl p-6">
        <summary className="cursor-pointer list-none font-display text-2xl">
          What your résumé says <span className="text-sm text-muted-foreground group-open:hidden">· show</span>
        </summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {p.roles.length > 0 && (
            <Section title="Experience">
              {p.roles.map((x, i) => (
                <li key={i}>
                  <p className="text-foreground">
                    {x.title}
                    {x.organization && <span className="text-muted-foreground"> · {x.organization}</span>}
                  </p>
                  {x.period && <p className="text-xs text-lavender">{x.period}</p>}
                  {x.responsibilities.length > 0 && <p className="text-xs text-muted-foreground">{x.responsibilities.join(" · ")}</p>}
                </li>
              ))}
            </Section>
          )}
          {p.education.length > 0 && (
            <Section title="Education">
              {p.education.map((x, i) => (
                <li key={i}>
                  <p className="text-foreground">{x.credential}</p>
                  <p className="text-xs text-muted-foreground">{[x.institution, x.period].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </Section>
          )}
          {p.projects.length > 0 && (
            <Section title="Projects">
              {p.projects.map((x, i) => (
                <li key={i}>
                  <p className="text-foreground">{x.name}</p>
                  {x.detail && <p className="text-xs text-muted-foreground">{x.detail}</p>}
                </li>
              ))}
            </Section>
          )}
          {p.accomplishments.length > 0 && (
            <Section title="Accomplishments">
              {p.accomplishments.map((x, i) => (
                <li key={i} className="text-muted-foreground">{x.text}</li>
              ))}
            </Section>
          )}
          {p.skills_named.length > 0 && (
            <div className="md:col-span-2">
              <p className="eyebrow mb-2">Skills it names</p>
              <div className="flex flex-wrap gap-1.5">
                {p.skills_named.map((s) => (
                  <Badge key={s.name} variant="outline">{s.name}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-3xl">Review before anything joins your Atlas</h3>
            <p className="text-sm text-muted-foreground">Confirm what's true, edit the wording, reject what isn't you. Confirming a hypothesis keeps it marked as a hypothesis.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setReview((prev) => {
                const next = { ...prev };
                for (const f of r.findings) if (f.classification === "direct" && !next[f.id]) next[f.id] = { decision: "confirmed" };
                return next;
              })
            }
          >
            <Check /> Confirm all directly supported
          </Button>
        </div>
        <div className="space-y-5">
          {GROUPS.map((g) => {
            const items = r.findings.filter((f) => f.classification === g.key);
            return (
              <Panel key={g.key} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={g.badge}>{g.title}</Badge>
                  <p className="text-xs text-muted-foreground">{items.length ? g.note : "None in this résumé."}</p>
                </div>
                {items.length > 0 && (
                  <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((f) => (
                      <FindingCard key={f.id} f={f} decision={review[f.id]} passages={passages} onChange={(d) => set(f.id, d)} />
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
        <div className="glass sticky bottom-4 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3">
          <p className="text-sm text-muted-foreground">
            {confirmed} confirmed · {saved} currently in your Atlas{dirty && <span className="text-gold"> · unsaved changes</span>}
          </p>
          <Button onClick={commit} disabled={!dirty || save.busy}>
            {save.busy ? <Loader2 className="animate-spin" /> : <Check />} {confirmed ? `Save · ${confirmed} to my Capability Atlas` : "Save choices"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="rounded-full border border-border px-3 py-1">
      <span className="font-display text-lg text-gold">{n}</span> <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FindingCard({
  f,
  decision,
  passages,
  onChange,
}: {
  f: ResumeFinding;
  decision: ResumeDecision | undefined;
  passages: Map<string, { quote: string; verified: boolean | null }>;
  onChange: (d: ResumeDecision | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(decision?.name ?? f.name);
  const shown = decision?.name || f.name;
  const state = decision?.decision;
  return (
    <li
      className={cn(
        "rounded-2xl border p-4 transition",
        state === "confirmed" ? "border-gold/60 bg-gold/5" : state === "rejected" ? "border-border opacity-50" : "border-border",
      )}
    >
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            onChange({ decision: "confirmed", ...(n && n !== f.name ? { name: n.slice(0, 60) } : {}) });
            setEditing(false);
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Capability name" autoFocus />
          <Button type="submit" size="sm">Save</Button>
        </form>
      ) : (
        <p className={cn("font-display text-xl leading-tight", state === "rejected" && "line-through")}>{shown}</p>
      )}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {!f.named_in_resume && <Badge variant="hypothesis" className="text-[10px]">Not named in your résumé</Badge>}
        {decision?.name && <Badge variant="outline" className="text-[10px]">Edited from “{f.name}”</Badge>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{f.explanation}</p>
      {f.passage_ids.length > 0 && (
        <ul className="mt-2 space-y-1">
          {f.passage_ids.map((pid) => {
            const p = passages.get(pid);
            return p ? (
              <li key={pid} className="border-l-2 border-gold/40 pl-2 text-xs italic text-pearl/80">
                “{p.quote}”
              </li>
            ) : null;
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant={state === "confirmed" ? "default" : "outline"} onClick={() => onChange(state === "confirmed" ? null : { decision: "confirmed", ...(decision?.name ? { name: decision.name } : {}) })}>
          <Check /> {state === "confirmed" ? "Confirmed" : f.classification === "insufficient" ? "Add as hypothesis" : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          <Pencil /> Edit
        </Button>
        <Button size="sm" variant={state === "rejected" ? "secondary" : "ghost"} onClick={() => onChange(state === "rejected" ? null : { decision: "rejected" })}>
          <X /> {state === "rejected" ? "Rejected" : "Not me"}
        </Button>
      </div>
    </li>
  );
}
