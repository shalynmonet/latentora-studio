import { Check, Copy, Download, X } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BUILDERS,
  PREFERENCES,
  blueprintMarkdown,
  preferenceLabel,
  type ApprovedDetail,
  type Blueprint,
  type Builder,
  type DesignDecision,
  type EvidenceItem,
  type PreferenceKey,
  type Rationale,
  type ToolConcept,
} from "@/lib/made-for-me";
import { cn } from "@/lib/utils";

export function KindBadge({ kind }: { kind: EvidenceItem["kind"] | DesignDecision["basis"] }) {
  if (kind === "stated") return <Badge variant="evidence">You told us</Badge>;
  if (kind === "demonstrated") return <Badge variant="evidence">Demonstrated</Badge>;
  if (kind === "tested") return <Badge variant="tested">Tested in Proof Lab</Badge>;
  if (kind === "preference") return <Badge variant="tested">Your preference</Badge>;
  return <Badge variant="hypothesis">AI hypothesis</Badge>;
}

export function EvidenceList({ ids, evidence, className }: { ids: string[]; evidence: EvidenceItem[]; className?: string }) {
  const items = ids.map((id) => evidence.find((e) => e.id === id)).filter(Boolean) as EvidenceItem[];
  if (!items.length) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((e) => (
        <li key={e.id} className="flex flex-wrap items-start gap-2 text-xs text-muted-foreground">
          <KindBadge kind={e.kind} />
          <span className="min-w-0 flex-1">“{e.text}”</span>
        </li>
      ))}
    </ul>
  );
}

const ACCENTS = [
  "from-gold/25 via-transparent to-transparent",
  "from-lavender/25 via-transparent to-transparent",
  "from-plum/60 via-transparent to-transparent",
];
const NUMERALS = ["I", "II", "III"];

export function ConceptCard({
  concept,
  index,
  evidence,
  selected,
  onSelect,
  onReject,
  disabled,
}: {
  concept: ToolConcept;
  index: number;
  evidence: EvidenceItem[];
  selected?: boolean;
  onSelect?: () => void;
  onReject?: () => void;
  disabled?: boolean;
}) {
  return (
    <article
      className={cn(
        "glass relative flex flex-col overflow-hidden rounded-3xl p-6 transition-shadow motion-safe:animate-rise",
        selected && "shadow-glow ring-2 ring-gold/70",
      )}
      style={{ animationDelay: `${index * 90}ms` }}
      aria-label={concept.name}
    >
      <div className={cn("pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br", ACCENTS[index % 3])} />
      <p className="font-display text-4xl text-gold-gradient">{NUMERALS[index] ?? index + 1}</p>
      <h3 className="mt-2 text-3xl leading-tight">{concept.name}</h3>
      <p className="mt-3 text-sm">{concept.what_it_does}</p>

      <div className="mt-5 space-y-4 text-sm">
        <div>
          <p className="eyebrow mb-1">Why this tool is for you</p>
          <p className="text-muted-foreground">{concept.why_for_you}</p>
          <EvidenceList ids={concept.evidence_ids} evidence={evidence} className="mt-2" />
        </div>
        <div>
          <p className="eyebrow mb-1">What becomes possible</p>
          <p className="text-muted-foreground">{concept.what_becomes_possible}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Not another generic tool</p>
          <p className="text-muted-foreground">{concept.differs_from_generic}</p>
        </div>
        {concept.assumptions.length > 0 && (
          <div>
            <p className="eyebrow mb-1">What I'm assuming</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {concept.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(onSelect || onReject) && (
        <div className="mt-6 flex flex-wrap gap-2 pt-2">
          {onSelect && (
            <Button onClick={onSelect} disabled={disabled} variant={selected ? "default" : "outline"}>
              {selected ? <Check /> : null} {selected ? "Selected" : "Choose this tool"}
            </Button>
          )}
          {onReject && (
            <Button onClick={onReject} disabled={disabled} variant="ghost" aria-label={`Not for me: ${concept.name}`}>
              <X /> Not for me
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

export function PreferencesPanel({
  value,
  onChange,
  custom,
  onCustom,
}: {
  value: PreferenceKey[];
  onChange: (v: PreferenceKey[]) => void;
  custom: string;
  onCustom: (v: string) => void;
}) {
  const toggle = (k: PreferenceKey) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <fieldset>
      <legend className="text-2xl font-display">How would you like to use your tool?</legend>
      <p className="mt-1 text-sm text-muted-foreground">
        Optional. Pick any that suit you — no reasons needed. What you choose here changes how the tool works, not just a checklist.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {PREFERENCES.map((p) => {
          const on = value.includes(p.key);
          return (
            <label
              key={p.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 p-3 transition-colors focus-within:ring-2 focus-within:ring-ring",
                on ? "border-gold/60 bg-gold/10" : "hover:bg-accent/30",
              )}
            >
              <Checkbox checked={on} onCheckedChange={() => toggle(p.key)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      <Label htmlFor="mfm-custom" className="mt-5 block">
        Anything else about how it should work for you?
      </Label>
      <Textarea
        id="mfm-custom"
        className="mt-2"
        rows={2}
        maxLength={600}
        value={custom}
        onChange={(e) => onCustom(e.target.value)}
        placeholder="e.g. I mostly use my phone one-handed"
      />
    </fieldset>
  );
}

export function BuilderPicker({ value, onChange }: { value: Builder; onChange: (b: Builder) => void }) {
  return (
    <div role="radiogroup" aria-label="Which builder will you use?" className="flex flex-wrap gap-2">
      {BUILDERS.map((b) => (
        <button
          key={b.key}
          type="button"
          role="radio"
          aria-checked={value === b.key}
          onClick={() => onChange(b.key)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            value === b.key ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export function RationaleView({
  rationale,
  evidence,
  included,
  onToggle,
}: {
  rationale: Rationale;
  evidence: EvidenceItem[];
  included?: string[];
  onToggle?: (id: string) => void;
}) {
  return (
    <div>
      {rationale.intro && <p className="font-display text-2xl leading-snug text-pearl">{rationale.intro}</p>}
      <ol className="mt-6 space-y-4">
        {rationale.decisions.map((d, i) => (
          <li key={d.id} className="rounded-2xl border border-border/60 bg-background/30 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl text-gold">{i + 1}.</span>
              <h4 className="flex-1 text-xl">{d.decision}</h4>
              <KindBadge kind={d.basis} />
            </div>
            {d.because && <p className="mt-2 text-sm">{d.because}</p>}
            {d.benefit && (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="text-lavender">Intended benefit:</span> {d.benefit}
              </p>
            )}
            <EvidenceList ids={d.evidence_ids} evidence={evidence} className="mt-3" />
            {onToggle && included && (
              <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={included.includes(d.id)} onCheckedChange={() => onToggle(d.id)} />
                Include this decision in my build prompt
              </label>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DetailsReview({
  details,
  onChange,
}: {
  details: (ApprovedDetail & { include: boolean; label: string })[];
  onChange: (d: (ApprovedDetail & { include: boolean; label: string })[]) => void;
}) {
  return (
    <div>
      <h3 className="text-2xl">Review what goes into your build prompt</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your prompt will be pasted into another service. Only details you keep ticked are sent to Muse Spark for the blueprint and
        included in the prompt. Edit any wording you'd rather not share.
      </p>
      <ul className="mt-4 space-y-3">
        {details.map((d, i) => (
          <li key={d.id} className="rounded-2xl border border-border/60 p-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={d.include}
                onCheckedChange={() => onChange(details.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))}
              />
              Share: {d.label}
            </label>
            <Textarea
              aria-label={`Wording for ${d.label}`}
              className="mt-2"
              rows={2}
              disabled={!d.include}
              value={d.text}
              maxLength={400}
              onChange={(e) => onChange(details.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function downloadBlueprint(b: Blueprint, rationale: Rationale | null, evidence: EvidenceItem[], approved: ApprovedDetail[] | null) {
  const md = blueprintMarkdown(b, rationale, evidence, approved);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${b.tool_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-tool"}-blueprint.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast.success("Build prompt copied.");
  } catch {
    toast.error("Your browser blocked copying — select the prompt and copy it manually.");
  }
}

function Section({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border/50 pt-6">
      <h3 className="flex items-baseline gap-3 text-2xl">
        <span className="font-display text-gold">{letter}</span> {title}
      </h3>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

/** The A–I sections of the blueprint, rendered as an editorial document. */
export function BlueprintSections({ b }: { b: Blueprint }) {
  return (
    <div className="space-y-6">
      <Section letter="A" title="Personal purpose">
        <p>{b.purpose}</p>
      </Section>
      <Section letter="B" title="Your requirements">
        <Bullets items={b.user_requirements} />
      </Section>
      <Section letter="C" title="Core functionality">
        <ol className="space-y-2">
          {b.core_features.map((f) => (
            <li key={f.name} className="flex gap-3">
              <Badge variant={f.priority === "must" ? "evidence" : f.priority === "should" ? "tested" : "hypothesis"} className="h-fit shrink-0">
                {f.priority}
              </Badge>
              <span>
                <span className="text-foreground">{f.name}</span> — {f.description}
              </span>
            </li>
          ))}
        </ol>
      </Section>
      <Section letter="D" title="Interface">
        <p>
          <span className="text-foreground">Layout:</span> {b.interface.layout}
        </p>
        <p className="mt-1">
          <span className="text-foreground">Navigation:</span> {b.interface.navigation}
        </p>
        <ul className="mt-2 space-y-1">
          {b.interface.screens.map((s) => (
            <li key={s.name}>
              <span className="text-foreground">{s.name}</span> — {s.purpose}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          <span className="text-foreground">Responsive:</span> {b.interface.responsive}
        </p>
      </Section>
      <Section letter="E" title="Accessibility requirements">
        <Bullets items={b.accessibility} />
      </Section>
      <Section letter="F" title="Data and privacy">
        <p className="text-foreground">Stores</p>
        <Bullets items={b.data_privacy.stores} />
        <p className="mt-2 text-foreground">Keeps private</p>
        <Bullets items={b.data_privacy.keep_private} />
        <p className="mt-2">{b.data_privacy.edit_delete}</p>
      </Section>
      <Section letter="G" title="Technical architecture">
        <Bullets items={b.architecture} />
      </Section>
      <Section letter="H" title="Acceptance tests">
        <Bullets items={b.acceptance_tests} />
      </Section>
      <Section letter="I" title="First-use validation">
        <p>{b.first_use_validation.experiment}</p>
        <p className="mt-2">
          <span className="text-foreground">Measure:</span> {b.first_use_validation.measures.join(" · ")} ({b.first_use_validation.duration})
        </p>
      </Section>
    </div>
  );
}

export function PrefList({ prefs }: { prefs: PreferenceKey[] }) {
  if (!prefs.length) return <p className="text-sm text-muted-foreground">No interaction preferences chosen.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {prefs.map((p) => (
        <Badge key={p} variant="tested">
          {preferenceLabel(p)}
        </Badge>
      ))}
    </div>
  );
}

export function PromptActions({ prompt, onDownload }: { prompt: string; onDownload: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => copyText(prompt)}>
        <Copy /> Copy Build Prompt
      </Button>
      <Button variant="outline" onClick={onDownload}>
        <Download /> Download Blueprint
      </Button>
    </div>
  );
}
