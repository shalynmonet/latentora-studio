import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageIntro, Panel, SourceBadge, WorkspaceGate } from "@/components/latentora/shared";
import { buildAtlas, opportunitiesAffected, type AtlasNode } from "@/lib/atlas";
import type { WorkspaceData } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/evolve")({
  head: () => ({
    meta: [
      { title: "Evolve — Capability Atlas · Latentora" },
      { name: "description", content: "A living constellation of your demonstrated, hypothesised and tested capabilities." },
      { property: "og:title", content: "Evolve — Capability Atlas · Latentora" },
      { property: "og:description", content: "Watch your capabilities move from hunch to evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvolvePage,
});

function EvolvePage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro
        step={5}
        title={
          <>
            Your <em className="text-gold-gradient">capability</em> constellation
          </>
        }
        sub="Gold stars are evidenced in your stories. Lavender stars are AI hypotheses. Pearl stars with a halo have been tested in the Proof Lab."
      />
      <WorkspaceGate>{(ws) => <Atlas ws={ws} />}</WorkspaceGate>
    </div>
  );
}

const CATEGORY_ANGLE: Record<string, number> = {
  systems: 0,
  analytical: 60,
  craft: 120,
  creative: 180,
  people: 240,
  resilience: 300,
};

function layout(nodes: AtlasNode[]) {
  const groups: Record<string, AtlasNode[]> = {};
  for (const n of nodes) (groups[n.category] ??= []).push(n);
  const pos: Record<string, { x: number; y: number }> = {};
  for (const [cat, list] of Object.entries(groups)) {
    const base = ((CATEGORY_ANGLE[cat] ?? 30) * Math.PI) / 180;
    list.forEach((n, i) => {
      const r = 150 + (i % 3) * 70 + (n.status === "hypothesized" ? 30 : 0);
      const a = base + (i - (list.length - 1) / 2) * 0.32;
      pos[n.id] = { x: 400 + Math.cos(a) * r, y: 330 + Math.sin(a) * r * 0.78 };
    });
  }
  return pos;
}

const BG_STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 137.5) % 800,
  y: (i * 89.3) % 660,
  r: (i % 5) * 0.25 + 0.4,
  d: (i % 7) * 0.6,
}));

function Atlas({ ws }: { ws: WorkspaceData }) {
  const { nodes, edges } = useMemo(() => buildAtlas(ws.analysis, ws.experiments), [ws.analysis, ws.experiments]);
  const [active, setActive] = useState<string | null>(null);
  const pos = useMemo(() => layout(nodes), [nodes]);
  const affected = useMemo(() => opportunitiesAffected(nodes, ws.opportunities), [nodes, ws.opportunities]);

  if (nodes.length === 0)
    return (
      <EmptyState
        title="No stars yet"
        body="Run Discover to map your capabilities, or complete a Proof Lab challenge."
        action={
          <Button asChild>
            <Link to="/discover">Start with your story</Link>
          </Button>
        }
      />
    );

  const sel = nodes.find((n) => n.id === active) ?? null;
  const counts = {
    demonstrated: nodes.filter((n) => n.status === "demonstrated").length,
    hypothesized: nodes.filter((n) => n.status === "hypothesized").length,
    tested: nodes.filter((n) => n.status === "tested").length,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="glass relative overflow-hidden rounded-3xl">
        <svg viewBox="0 0 800 660" className="h-auto w-full" role="img" aria-label="Capability constellation">
          <defs>
            <radialGradient id="glow-gold">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="glow-lav">
              <stop offset="0%" stopColor="var(--lavender)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="var(--lavender)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="glow-pearl">
              <stop offset="0%" stopColor="var(--pearl)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--pearl)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {BG_STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="var(--pearl)" className="animate-twinkle" style={{ animationDelay: `${s.d}s` }} opacity={0.5} />
          ))}
          <circle cx={400} cy={330} r={4} fill="var(--gold)" />
          {nodes.map((n) => (
            <line key={`spoke-${n.id}`} x1={400} y1={330} x2={pos[n.id].x} y2={pos[n.id].y} stroke="var(--border)" strokeWidth={0.6} strokeDasharray="2 5" />
          ))}
          {edges.map((e, i) => (
            <line key={i} x1={pos[e.from].x} y1={pos[e.from].y} x2={pos[e.to].x} y2={pos[e.to].y} stroke="var(--gold)" strokeOpacity={0.5} strokeWidth={1} />
          ))}
          {nodes.map((n) => {
            const p = pos[n.id];
            const glow = n.status === "tested" ? "url(#glow-pearl)" : n.status === "demonstrated" ? "url(#glow-gold)" : "url(#glow-lav)";
            const core = n.status === "tested" ? "var(--pearl)" : n.status === "demonstrated" ? "var(--gold)" : "var(--lavender)";
            const isActive = active === n.id;
            return (
              <g
                key={n.id}
                tabIndex={0}
                role="button"
                aria-label={`${n.name}, ${n.status}`}
                onClick={() => setActive(n.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(n.id)}
                className="cursor-pointer outline-none"
              >
                <circle cx={p.x} cy={p.y} r={isActive ? 34 : 24} fill={glow} className="transition-all duration-500" />
                {n.status === "tested" && <circle cx={p.x} cy={p.y} r={13} fill="none" stroke="var(--pearl)" strokeOpacity={0.7} strokeWidth={1} />}
                <circle cx={p.x} cy={p.y} r={n.status === "hypothesized" ? 4 : 6} fill={n.status === "hypothesized" ? "none" : core} stroke={core} strokeWidth={1.5} />
                <text x={p.x} y={p.y + 26} textAnchor="middle" fill="var(--foreground)" fontSize={12.5} fontFamily="var(--font-sans)" opacity={isActive ? 1 : 0.85}>
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <Badge variant="evidence">{counts.demonstrated} evidenced</Badge>
          <Badge variant="hypothesis">{counts.hypothesized} hypotheses</Badge>
          <Badge variant="tested">{counts.tested} tested</Badge>
        </div>
      </div>

      <div className="space-y-6">
        <Panel>
          {sel ? (
            <div>
              <Badge variant={sel.status === "tested" ? "tested" : sel.status === "demonstrated" ? "evidence" : "hypothesis"} className="capitalize">
                {sel.status === "tested" ? "Tested in Proof Lab" : sel.status === "demonstrated" ? "Evidenced in your stories" : "AI hypothesis"}
              </Badge>
              <h3 className="mt-3 text-3xl">{sel.name}</h3>
              <p className="text-xs uppercase tracking-widest text-lavender">{sel.category}</p>
              {sel.test && (
                <div className="mt-4 rounded-2xl border border-pearl/30 p-3 text-sm">
                  <p className="text-pearl">
                    Proof Lab: {sel.test.capability} —{" "}
                    {sel.test.verdict === "supported" ? "supported by your measurements" : "partially supported by your measurements"}
                  </p>
                  {sel.originalStatus && <p className="mt-1 text-xs text-muted-foreground">Was: {sel.originalStatus === "demonstrated" ? "evidenced in stories" : "AI hypothesis"}</p>}
                </div>
              )}
              {sel.evidence.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {sel.evidence.map((e, i) => (
                    <li key={i}>· {e}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-2xl">Select a star</h3>
              <p className="mt-1 text-sm text-muted-foreground">Click any capability to see the evidence behind it.</p>
              {ws.analysis && (
                <div className="mt-3">
                  <SourceBadge source={ws.analysis.source} model={ws.analysis.model} />
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel>
          <h3 className="text-2xl">How tests change your opportunities</h3>
          {ws.experiments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Complete the <Link to="/experiment" className="text-gold underline">Paper Structure Challenge</Link> to move a hypothesis toward evidence.
            </p>
          ) : affected.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Your tested capabilities don't appear in any matched opportunity yet. Match more listings on the Radar to see the connection.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {affected.map(({ opportunity, backed }) => (
                <li key={opportunity.id} className="rounded-2xl border border-border p-3 text-sm">
                  <p className="font-medium">{opportunity.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Now backed by test evidence: <span className="text-pearl">{backed.join(", ")}</span>. When you apply, you can point to a measured result instead of a claim.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className={cn("flex flex-wrap gap-2")}>
          <Button asChild variant="outline">
            <Link to="/experiment">Run another experiment</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/explore">Back to the Radar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
