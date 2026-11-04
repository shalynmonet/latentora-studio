// Made for Me server functions. Workspace-scoped (no sign-in), service-role client only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildAtlas } from "./atlas";
import { DEMO_PROFILES, demoCustomization } from "./made-for-me-demo";
import {
  PREFERENCE_KEYS,
  preferenceEvidence,
  type ApprovedDetail,
  type Blueprint,
  type Customization,
  type Discovery,
  type EvidenceItem,
  type Invention,
  type PreferenceKey,
  type Rationale,
  type ToolConcept,
} from "./made-for-me";
import type { Analysis, Experiment } from "./types";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max).default("");

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function pipeline() {
  return import("./made-for-me.server");
}

type Row = Record<string, unknown>;
const toInvention = (r: Row): Invention => r as unknown as Invention;

async function loadInvention(workspaceId: string, inventionId: string) {
  const db = await admin();
  const { data } = await db.from("inventions").select("*").eq("id", inventionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new Error("That invention couldn't be found in this workspace.");
  return toInvention(data as Row);
}

async function patchInvention(workspaceId: string, inventionId: string, patch: Record<string, unknown>) {
  const db = await admin();
  const { data, error } = await db
    .from("inventions")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", inventionId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  if (error || !data) throw new Error("Could not save your invention");
  return toInvention(data as Row);
}

/** Evidence the person has approved by using Latentora: their own words, stories and Atlas. */
async function gatherEvidence(
  workspaceId: string,
  intake: { ambition: string; friction: string; working_style: string; answers: { question: string; answer: string }[] },
): Promise<EvidenceItem[]> {
  const db = await admin();
  const [{ data: stories }, { data: analysis }, { data: exps }] = await Promise.all([
    db.from("stories").select("kind, title, description").eq("workspace_id", workspaceId).order("created_at").limit(12),
    db.from("analyses").select("id, source, model, result, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("experiments").select("*").eq("workspace_id", workspaceId),
  ]);
  const ev: EvidenceItem[] = [];
  if (intake.ambition) ev.push({ id: "goal", kind: "stated", label: "What you'd love to do", text: intake.ambition });
  if (intake.friction) ev.push({ id: "friction", kind: "stated", label: "What takes too much effort", text: intake.friction });
  if (intake.working_style) ev.push({ id: "style", kind: "stated", label: "How you like to work", text: intake.working_style });
  intake.answers.forEach((a, i) => {
    if (a.answer.trim()) ev.push({ id: `a${i + 1}`, kind: "stated", label: a.question, text: a.answer.trim() });
  });
  (stories ?? []).forEach((s, i) =>
    ev.push({ id: `s${i + 1}`, kind: "stated", label: `Your ${s.kind}: ${s.title}`, text: `${s.title} — ${String(s.description).slice(0, 280)}` }),
  );
  const atlas = buildAtlas((analysis as unknown as Analysis) ?? null, (exps ?? []) as unknown as Experiment[]);
  atlas.nodes.slice(0, 10).forEach((n, i) =>
    ev.push({
      id: `c${i + 1}`,
      kind: n.status === "hypothesized" ? "hypothesis" : n.status,
      label: `Capability Atlas · ${n.status === "hypothesized" ? "hypothesis" : n.status}`,
      text: `${n.name}${n.evidence[0] ? ` — ${n.evidence[0].slice(0, 200)}` : ""}`,
    }),
  );
  return ev;
}

/* ------------------------------- reads ------------------------------- */

export const listInventions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows } = await db.from("inventions").select("*").eq("workspace_id", data.id).order("updated_at", { ascending: false }).limit(40);
    return (rows ?? []).map((r) => toInvention(r as Row));
  });

export const getInvention = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, inventionId: uuid }).parse(d))
  .handler(async ({ data }) => loadInvention(data.id, data.inventionId));

/* ----------------------------- discovery ----------------------------- */

export const startInvention = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid,
        pathway: z.enum(["achieve", "easier", "both"]),
        ambition: text(1000),
        friction: text(1000),
        working_style: text(600),
      })
      .refine((v) => v.ambition.length >= 8 || v.friction.length >= 8, "Tell us a little more — a sentence is enough.")
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: ws } = await db.from("workspaces").select("id").eq("id", data.id).maybeSingle();
    if (!ws) throw new Error("Workspace not found");
    const evidence = await gatherEvidence(data.id, { ...data, answers: [] });
    const p = await pipeline();
    const res = await p.runDiscovery({ pathway: data.pathway, evidence, allowQuestions: true, round: 1, rejectedConcepts: [], rejectedNeeds: [] });
    const discovery: Discovery = { ...res, evidence, round: 1, source: "meta_live" };
    const { data: row, error } = await db
      .from("inventions")
      .insert({
        workspace_id: data.id,
        pathway: data.pathway,
        ambition: data.ambition,
        friction: data.friction,
        working_style: data.working_style,
        discovery: discovery as never,
        source: "meta_live",
        model: res.model,
      })
      .select("*")
      .single();
    if (error || !row) throw new Error("Could not save your invention");
    return toInvention(row as Row);
  });

const qa = z.array(z.object({ question: z.string().max(300), answer: z.string().trim().max(800) })).max(3);

export const answerFollowUps = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, inventionId: uuid, answers: qa }).parse(d))
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    const evidence = await gatherEvidence(data.id, { ...inv, answers: data.answers });
    const p = await pipeline();
    const res = await p.runDiscovery({ pathway: inv.pathway, evidence, allowQuestions: false, round: 1, rejectedConcepts: inv.rejected, rejectedNeeds: [] });
    const discovery: Discovery = { ...res, evidence, round: 1, source: "meta_live" };
    return patchInvention(data.id, data.inventionId, { answers: data.answers, discovery });
  });

export const refreshConcepts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, inventionId: uuid, rejectedNeedIds: z.array(z.string().max(10)).max(6).default([]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    if (!inv.discovery) throw new Error("Start with what you'd like to do first.");
    const round = inv.discovery.round + 1;
    const rejected = Array.from(new Set([...inv.rejected, ...inv.discovery.concepts.map((c) => c.name)])).slice(-15);
    const rejectedNeeds = inv.discovery.inferred_needs.filter((n) => data.rejectedNeedIds.includes(n.id)).map((n) => n.need);
    const p = await pipeline();
    const res = await p.runDiscovery({
      pathway: inv.pathway,
      evidence: inv.discovery.evidence,
      allowQuestions: false,
      round,
      rejectedConcepts: rejected,
      rejectedNeeds,
    });
    const keptNeeds = inv.discovery.inferred_needs.filter((n) => !data.rejectedNeedIds.includes(n.id));
    const discovery: Discovery = {
      ...res,
      inferred_needs: res.inferred_needs.length ? res.inferred_needs : keptNeeds,
      evidence: inv.discovery.evidence,
      round,
      source: "meta_live",
    };
    return patchInvention(data.id, data.inventionId, { discovery, rejected });
  });

export const rejectConcept = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, inventionId: uuid, conceptId: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    if (!inv.discovery) return inv;
    const c = inv.discovery.concepts.find((x) => x.id === data.conceptId);
    if (!c) return inv;
    return patchInvention(data.id, data.inventionId, {
      rejected: Array.from(new Set([...inv.rejected, c.name])),
      discovery: { ...inv.discovery, concepts: inv.discovery.concepts.filter((x) => x.id !== data.conceptId) },
    });
  });

/* ------------------------------ design ------------------------------ */

const customizationSchema = z.object({
  outcome: z.string().trim().min(3).max(600),
  assumptions: z
    .array(z.object({ text: z.string().max(300), status: z.enum(["unreviewed", "confirmed", "corrected", "rejected"]), correction: z.string().trim().max(300).default("") }))
    .max(6),
  preferences: z.array(z.enum(PREFERENCE_KEYS as [PreferenceKey, ...PreferenceKey[]])).max(PREFERENCE_KEYS.length),
  custom_instructions: z.string().trim().max(600).default(""),
  builder: z.enum(["lovable", "codex", "neutral"]),
});

export const designForMe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, inventionId: uuid, conceptId: z.string().max(20), customization: customizationSchema }).parse(d))
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    const concept = inv.discovery?.concepts.find((c) => c.id === data.conceptId) ?? (inv.selected?.id === data.conceptId ? inv.selected : null);
    if (!concept || !inv.discovery) throw new Error("Choose one of your tool ideas first.");
    const c = data.customization as Customization;
    const evidence = [...inv.discovery.evidence, ...preferenceEvidence(c.preferences, c.custom_instructions)];
    const p = await pipeline();
    const rationale = await p.runRationale(concept, c, evidence);
    return patchInvention(data.id, data.inventionId, { selected: concept, customization: c, rationale, blueprint: null });
  });

const approvedSchema = z.array(z.object({ id: z.string().max(20), text: z.string().trim().min(1).max(400) })).max(20);

export const buildBlueprint = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, inventionId: uuid, approved: approvedSchema, decisionIds: z.array(z.string().max(10)).max(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    if (!inv.selected || !inv.customization || !inv.rationale || !inv.discovery) throw new Error("Finish customizing your tool first.");
    const known = new Set(inv.discovery.evidence.map((e) => e.id));
    const approved: ApprovedDetail[] = data.approved.filter((d) => known.has(d.id));
    const decisions = inv.rationale.decisions.filter((d) => data.decisionIds.includes(d.id)).map((d) => ({ decision: d.decision, benefit: d.benefit }));
    const p = await pipeline();
    const blueprint = await p.runBlueprint({ concept: inv.selected, customization: inv.customization, decisions, approved });
    return patchInvention(data.id, data.inventionId, { blueprint, approved_details: approved });
  });

export const updateInvention = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, inventionId: uuid, saved: z.boolean().optional(), build_prompt: z.string().max(30000).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    const patch: { saved?: boolean; blueprint?: Blueprint } = {};
    if (data.saved !== undefined) patch.saved = data.saved;
    if (data.build_prompt !== undefined && inv.blueprint) patch.blueprint = { ...inv.blueprint, build_prompt: data.build_prompt } satisfies Blueprint;
    return patchInvention(data.id, data.inventionId, patch);
  });

export const deleteInvention = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, inventionId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("inventions").delete().eq("id", data.inventionId).eq("workspace_id", data.id);
    return { ok: true };
  });

/* ------------------------------ feedback ------------------------------ */

export const submitInventionFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid,
        inventionId: uuid,
        feedback: z.object({
          built: z.enum(["yes", "partly", "no"]),
          used: z.enum(["yes", "a_little", "no"]),
          worked: text(1000),
          didnt_work: text(1000),
          helped: z.enum(["yes", "somewhat", "no", "too_early"]),
          change: text(1000),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    if (!inv.blueprint) throw new Error("Generate a blueprint first.");
    const feedback = { ...data.feedback, submitted_at: new Date().toISOString() };
    // Save the feedback first so it isn't lost if Muse Spark is unavailable.
    await patchInvention(data.id, data.inventionId, { feedback });
    const p = await pipeline();
    const revision = await p.runRevision(inv.blueprint, feedback);
    return patchInvention(data.id, data.inventionId, { revision });
  });

/* --------------------------- Build with Muse --------------------------- */

export const buildWithMuse = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, inventionId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const inv = await loadInvention(data.id, data.inventionId);
    if (!inv.blueprint) throw new Error("Generate and review your blueprint first.");
    const { runMuseBuild } = await import("./build-with-muse.server");
    const build = await runMuseBuild(inv.blueprint);
    return patchInvention(data.id, data.inventionId, { build });
  });

/* ----------------------------- judge demo ----------------------------- */

const profileKey = z.enum(["A", "B"]);

export const demoDiscover = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ profile: profileKey }).parse(d))
  .handler(async ({ data }) => {
    const prof = DEMO_PROFILES.find((p) => p.key === data.profile)!;
    const p = await pipeline();
    const res = await p.runDiscovery({ pathway: "achieve", evidence: prof.evidence, allowQuestions: false, round: 1, rejectedConcepts: [], rejectedNeeds: [] });
    return { ...res, evidence: prof.evidence, round: 1, source: "meta_live" } as Discovery;
  });

export const demoDesign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        profile: profileKey,
        concept: z.object({
          id: z.string().max(20),
          name: z.string().max(80),
          what_it_does: z.string().max(800),
          why_for_you: z.string().max(800),
          evidence_ids: z.array(z.string().max(40)).max(12),
          what_becomes_possible: z.string().max(800),
          differs_from_generic: z.string().max(800),
          assumptions: z.array(z.string().max(240)).max(5),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const prof = DEMO_PROFILES.find((p) => p.key === data.profile)!;
    const concept = data.concept as ToolConcept;
    const c = demoCustomization(prof, concept.what_becomes_possible || "Finish more creative projects");
    const evidence = [...prof.evidence, ...preferenceEvidence(c.preferences)];
    const p = await pipeline();
    const rationale: Rationale = await p.runRationale(concept, c, evidence);
    const approved = prof.evidence.filter((e) => e.kind === "stated").map((e) => ({ id: e.id, text: e.text }));
    const blueprint = await p.runBlueprint({ concept, customization: c, decisions: rationale.decisions.map((d) => ({ decision: d.decision, benefit: d.benefit })), approved });
    return { rationale, blueprint };
  });

const str = (n: number) => z.string().max(n);
const strs = (items: number, n = 600) => z.array(str(n)).max(items);
/** Stateless Build with Muse for the fictional judge-demo profiles (no workspace data involved). */
export const demoBuild = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        profile: profileKey,
        blueprint: z.object({
          tool_name: str(80),
          purpose: str(1000),
          user_requirements: strs(10),
          core_features: z.array(z.object({ name: str(100), description: str(600), priority: z.enum(["must", "should", "could"]) })).max(10),
          interface: z.object({
            layout: str(800),
            navigation: str(600),
            screens: z.array(z.object({ name: str(80), purpose: str(400) })).max(8),
            interactions: strs(10),
            responsive: str(600),
          }),
          accessibility: strs(30),
          data_privacy: z.object({ stores: strs(10), keep_private: strs(10), edit_delete: str(600) }),
          architecture: strs(10),
          acceptance_tests: strs(12),
          first_use_validation: z.object({ experiment: str(800), measures: strs(6), duration: str(200) }),
          intended_benefit: str(800),
          builder: z.enum(["lovable", "codex", "neutral"]),
          design_decisions: z.array(z.object({ decision: str(600), benefit: str(600) })).max(10),
          generated_at: str(40),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const prof = DEMO_PROFILES.find((p) => p.key === data.profile)!;
    const { runMuseBuild } = await import("./build-with-muse.server");
    // Preferences and personal context come from the fictional profile on the server, not the request.
    const blueprint = {
      ...data.blueprint,
      preferences: prof.preferences,
      personal_context: prof.evidence.filter((e) => e.kind === "stated").map((e) => ({ id: e.id, text: e.text })),
      build_prompt: "",
      source: "meta_live",
      model: null,
    } as Blueprint;
    return runMuseBuild(blueprint);
  });
