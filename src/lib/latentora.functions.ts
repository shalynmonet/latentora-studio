// All app server functions. Data is keyed by an unguessable workspace id held in the
// browser (no sign-in). Admin client is loaded inside handlers only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEMO_ANALYSIS, DEMO_LISTINGS, DEMO_MATCHES, DEMO_PROFILE_NAME, DEMO_STORIES } from "./demo-data";
import { heuristicAnalysis, heuristicMatch } from "./heuristics";
import { describeSegmentation, parseSamBoxes } from "./sam-parse";
import { scorePaperChallenge } from "./scoring";
import type {
  AnalysisResult,
  ApiStatus,
  JobListing,
  OpportunityMatch,
  ResultSource,
  SegmentationEvidence,
  WorkspaceData,
} from "./types";

const BUCKET = "latentora-media";
const uuid = z.string().uuid();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function meta() {
  return import("./meta.server");
}

async function assertWorkspace(id: string) {
  const db = await admin();
  const { data, error } = await db.from("workspaces").select("id, display_name, is_demo").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load your workspace");
  if (!data) throw new Error("Workspace not found");
  return data;
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------ status ------------------------------ */

export const getApiStatus = createServerFn({ method: "GET" }).handler(async (): Promise<ApiStatus> => {
  const { metaConfigured } = await meta();
  return { metaConfigured: metaConfigured() };
});

/* ---------------------------- workspaces ---------------------------- */

export const createWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ demo: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: ws, error } = await db
      .from("workspaces")
      .insert({ display_name: data.demo ? DEMO_PROFILE_NAME : "My story", is_demo: data.demo })
      .select("id")
      .single();
    if (error || !ws) throw new Error("Could not create a workspace");

    if (data.demo) {
      await db.from("stories").insert(DEMO_STORIES.map((s) => ({ ...s, workspace_id: ws.id })));
      await db.from("analyses").insert({
        workspace_id: ws.id,
        source: "demo_sample",
        model: null,
        result: DEMO_ANALYSIS as never,
      });
      const { data: opps } = await db
        .from("opportunities")
        .insert(
          DEMO_LISTINGS.map((l) => ({
            workspace_id: ws.id,
            source: "demo_sample",
            external_id: l.external_id,
            title: l.title,
            company: l.company,
            url: null,
            location: l.location,
            description: l.description,
            match: DEMO_MATCHES[l.external_id] as never,
            match_source: "demo_sample",
          })),
        )
        .select("id, external_id");
      const byExt = Object.fromEntries((opps ?? []).map((o) => [o.external_id, o.id]));
      await db.from("vision_boards").insert([
        {
          workspace_id: ws.id,
          opportunity_id: byExt["demo-edu-2"] ?? null,
          title: "Leading a community design workshop",
          prompt: "Sample illustration bundled with the demo profile.",
          image_url: "asset:sample-board-1",
          source: "demo_sample",
          saved: true,
        },
        {
          workspace_id: ws.id,
          opportunity_id: byExt["demo-ops-1"] ?? null,
          title: "Remote operations research, late evening",
          prompt: "Sample illustration bundled with the demo profile.",
          image_url: "asset:sample-board-2",
          source: "demo_sample",
          saved: true,
        },
      ]);
    }
    return { id: ws.id };
  });

export const getWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }): Promise<WorkspaceData | null> => {
    const db = await admin();
    const { data: ws } = await db.from("workspaces").select("id, display_name, is_demo").eq("id", data.id).maybeSingle();
    if (!ws) return null;
    const [stories, analyses, opps, boards, exps] = await Promise.all([
      db.from("stories").select("id, kind, title, description, created_at").eq("workspace_id", ws.id).order("created_at"),
      db.from("analyses").select("id, source, model, result, created_at").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(1),
      db.from("opportunities").select("*").eq("workspace_id", ws.id).order("created_at", { ascending: false }),
      db.from("vision_boards").select("*").eq("workspace_id", ws.id).order("created_at", { ascending: false }),
      db.from("experiments").select("*").eq("workspace_id", ws.id).order("created_at", { ascending: false }),
    ]);

    // Sign private storage paths for display.
    const paths = [
      ...(boards.data ?? []).map((b) => b.image_url),
      ...(exps.data ?? []).map((e) => e.photo_url ?? ""),
    ].filter((p) => p.startsWith("storage:"));
    const signed: Record<string, string> = {};
    if (paths.length) {
      const { data: urls } = await db.storage
        .from(BUCKET)
        .createSignedUrls(paths.map((p) => p.slice(8)), 60 * 60 * 12);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed[`storage:${u.path}`] = u.signedUrl;
    }
    const resolve = (p: string | null) => (p && p.startsWith("storage:") ? (signed[p] ?? "") : p);

    return {
      workspace: ws,
      stories: (stories.data ?? []) as WorkspaceData["stories"],
      analysis: (analyses.data?.[0] ?? null) as WorkspaceData["analysis"],
      opportunities: (opps.data ?? []).map((o) => ({
        id: o.id,
        source: o.source,
        external_id: o.external_id,
        title: o.title,
        company: o.company,
        url: o.url,
        location: o.location,
        description: o.description,
        match: o.match,
        match_source: o.match_source,
        created_at: o.created_at,
      })) as WorkspaceData["opportunities"],
      boards: (boards.data ?? []).map((b) => ({
        id: b.id,
        opportunity_id: b.opportunity_id,
        title: b.title,
        prompt: b.prompt,
        image_url: resolve(b.image_url) ?? "",
        source: b.source,
        saved: b.saved,
        created_at: b.created_at,
      })) as WorkspaceData["boards"],
      experiments: (exps.data ?? []).map((e) => ({
        id: e.id,
        challenge: e.challenge,
        inputs: e.inputs,
        score: e.score,
        evidence_mode: e.evidence_mode,
        segmentation: e.segmentation,
        photo_url: resolve(e.photo_url),
        created_at: e.created_at,
      })) as WorkspaceData["experiments"],
    };
  });

/* ------------------------------ stories ----------------------------- */

export const addStory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid,
        kind: z.enum(["project", "experience", "interest", "accomplishment"]),
        title: z.string().trim().min(2).max(140),
        description: z.string().trim().min(20).max(3000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await assertWorkspace(data.id);
    const db = await admin();
    const { error } = await db
      .from("stories")
      .insert({ workspace_id: data.id, kind: data.kind, title: data.title, description: data.description });
    if (error) throw new Error("Could not save your story");
    return { ok: true };
  });

export const deleteStory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, storyId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("stories").delete().eq("id", data.storyId).eq("workspace_id", data.id);
    return { ok: true };
  });

/* ------------------------------ analyze ----------------------------- */

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    capabilities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["craft", "systems", "people", "creative", "analytical", "resilience"] },
          status: { type: "string", enum: ["demonstrated", "hypothesized"] },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: { story_title: { type: "string" }, detail: { type: "string" } },
              required: ["story_title", "detail"],
            },
          },
          rationale: { type: "string" },
        },
        required: ["name", "category", "status", "evidence", "rationale"],
      },
    },
    transferable_skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          from_context: { type: "string" },
          to_contexts: { type: "array", items: { type: "string" } },
          why: { type: "string" },
        },
        required: ["name", "from_context", "to_contexts", "why"],
      },
    },
    connections: {
      type: "array",
      items: {
        type: "object",
        properties: { between: { type: "array", items: { type: "string" } }, insight: { type: "string" } },
        required: ["between", "insight"],
      },
    },
    needs_validation: {
      type: "array",
      items: {
        type: "object",
        properties: { capability: { type: "string" }, what_would_prove_it: { type: "string" } },
        required: ["capability", "what_would_prove_it"],
      },
    },
  },
  required: ["summary", "capabilities", "transferable_skills", "connections", "needs_validation"],
};

export const analyzeStories = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    await assertWorkspace(data.id);
    const db = await admin();
    const { data: stories } = await db.from("stories").select("kind, title, description").eq("workspace_id", data.id);
    if (!stories || stories.length < 3) throw new Error("Add at least three stories first");

    const m = await meta();
    let result: AnalysisResult;
    let source: ResultSource = "meta_live";
    let notice: string | null = null;
    try {
      result = await m.sparkJSON<AnalysisResult>({
        schemaName: "capability_analysis",
        schema: ANALYSIS_SCHEMA,
        system:
          "You are Latentora, a careful career-discovery analyst. Read the person's stories and identify capabilities. " +
          "Mark a capability 'demonstrated' ONLY when a story directly describes them doing it; quote or paraphrase that detail as evidence with the exact story title. " +
          "Mark it 'hypothesized' when you are inferring it. Never invent facts not in the stories. No numeric scores or percentages of confidence. " +
          "List 5-9 capabilities with short names (2-4 words). Connections must reference capability names exactly as listed. " +
          "Transferable skills should point to concrete roles or contexts. Use warm, plain English.",
        user: stories.map((s, i) => `Story ${i + 1} [${s.kind}] "${s.title}":\n${s.description}`).join("\n\n"),
      });
    } catch (e) {
      if (!(e instanceof m.MetaUnavailableError)) throw e;
      result = heuristicAnalysis(stories);
      source = "offline_heuristic";
      notice = "The Meta model was unavailable, so an offline keyword scan was used instead.";
    }

    await db.from("analyses").insert({
      workspace_id: data.id,
      source,
      model: source === "meta_live" ? m.META_MODELS.spark : null,
      result: result as never,
    });
    return { source, notice };
  });

/* --------------------------- opportunities -------------------------- */

const CACHE_HOURS = 12; // Remotive asks for at most ~4 requests/day.

export const searchJobs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().max(60) }).parse(d))
  .handler(async ({ data }): Promise<{ listings: JobListing[]; source: "remotive" | "demo_sample"; error: string | null }> => {
    const q = data.query.toLowerCase();
    const db = await admin();
    const { data: cached } = await db.from("job_cache").select("payload, fetched_at").eq("query", q).maybeSingle();
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_HOURS * 3600_000) {
      return { listings: cached.payload as unknown as JobListing[], source: "remotive", error: null };
    }
    try {
      const url = `https://remotive.com/api/remote-jobs?limit=20${q ? `&search=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url, { headers: { "User-Agent": "Latentora/1.0" } });
      if (!res.ok) throw new Error(`Remotive ${res.status}`);
      const json = (await res.json()) as { jobs: Record<string, string>[] };
      const listings: JobListing[] = (json.jobs ?? []).slice(0, 20).map((j) => ({
        external_id: String(j.id),
        title: j.title,
        company: j.company_name,
        url: j.url,
        location: j.candidate_required_location ?? "Remote",
        category: j.category ?? "",
        description: stripHtml(j.description ?? "").slice(0, 4000),
        published_at: j.publication_date ?? "",
      }));
      await db.from("job_cache").upsert({ query: q, payload: listings as never, fetched_at: new Date().toISOString() });
      return { listings, source: "remotive", error: null };
    } catch (e) {
      console.error("Remotive fetch failed", e);
      if (cached) return { listings: cached.payload as unknown as JobListing[], source: "remotive", error: "Showing the last saved results — the live job feed didn't respond." };
      return { listings: DEMO_LISTINGS, source: "demo_sample", error: "The live job feed is unavailable, so sample listings are shown." };
    }
  });

const listingInput = z.object({
  source: z.enum(["remotive", "pasted", "demo_sample"]),
  external_id: z.string().max(80).nullable(),
  title: z.string().trim().min(2).max(200),
  company: z.string().trim().max(200).nullable(),
  url: z.string().trim().max(500).nullable(),
  location: z.string().trim().max(200).nullable(),
  description: z.string().trim().min(20).max(6000),
});

export const saveOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, listing: listingInput }).parse(d))
  .handler(async ({ data }) => {
    await assertWorkspace(data.id);
    const db = await admin();
    const url = data.listing.url && /^https?:\/\//.test(data.listing.url) ? data.listing.url : null;
    if (data.listing.external_id) {
      const { data: existing } = await db
        .from("opportunities")
        .select("id")
        .eq("workspace_id", data.id)
        .eq("external_id", data.listing.external_id)
        .maybeSingle();
      if (existing) return { opportunityId: existing.id };
    }
    const { data: row, error } = await db
      .from("opportunities")
      .insert({ workspace_id: data.id, ...data.listing, url })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save this opportunity");
    return { opportunityId: row.id };
  });

export const deleteOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, opportunityId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("opportunities").delete().eq("id", data.opportunityId).eq("workspace_id", data.id);
    return { ok: true };
  });

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          fit: { type: "string", enum: ["strong", "promising", "stretch", "weak"] },
          abilities_used: { type: "array", items: { type: "string" } },
          evidence: { type: "array", items: { type: "string" } },
          missing: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
        required: ["ref", "fit", "abilities_used", "evidence", "missing", "rationale"],
      },
    },
  },
  required: ["matches"],
};

export const matchOpportunities = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, opportunityIds: z.array(uuid).min(1).max(8) }).parse(d))
  .handler(async ({ data }) => {
    await assertWorkspace(data.id);
    const db = await admin();
    const [{ data: analysis }, { data: opps }] = await Promise.all([
      db.from("analyses").select("result").eq("workspace_id", data.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("opportunities").select("id, title, company, description").eq("workspace_id", data.id).in("id", data.opportunityIds),
    ]);
    if (!analysis) throw new Error("Run Discover first so we know your capabilities");
    if (!opps?.length) throw new Error("No opportunities selected");
    const result = analysis.result as unknown as AnalysisResult;

    const m = await meta();
    let source: ResultSource = "meta_live";
    let notice: string | null = null;
    let matches: (OpportunityMatch & { ref: string })[];
    try {
      const out = await m.sparkJSON<{ matches: (OpportunityMatch & { ref: string })[] }>({
        schemaName: "opportunity_matches",
        schema: MATCH_SCHEMA,
        system:
          "You match a person to opportunities by TRANSFERABLE ABILITIES, not job-title keywords. " +
          "For each opportunity (identified by ref) return: fit (strong/promising/stretch/weak), abilities_used (names from the person's capability list), " +
          "evidence (short phrases drawn from the person's capability evidence), missing (qualifications the listing asks for that the person hasn't shown), and a one-to-two sentence rationale. " +
          "Be honest: if the listing needs credentials they lack, say so. No numeric scores.",
        user:
          `PERSON CAPABILITIES:\n${JSON.stringify(
            result.capabilities.map((c) => ({ name: c.name, status: c.status, evidence: c.evidence.map((e) => e.detail) })),
          )}\n\nTRANSFERABLE SKILLS:\n${JSON.stringify(result.transferable_skills)}\n\nOPPORTUNITIES:\n` +
          opps.map((o) => `ref=${o.id}\nTitle: ${o.title}\nCompany: ${o.company ?? "-"}\n${o.description.slice(0, 1800)}`).join("\n---\n"),
      });
      matches = out.matches;
    } catch (e) {
      if (!(e instanceof m.MetaUnavailableError)) throw e;
      source = "offline_heuristic";
      notice = "The Meta model was unavailable, so an offline keyword comparison was used.";
      const names = result.capabilities.map((c) => c.name);
      matches = opps.map((o) => ({ ref: o.id, ...heuristicMatch(names, `${o.title} ${o.description}`) }));
    }

    for (const mt of matches) {
      if (!opps.some((o) => o.id === mt.ref)) continue;
      const { ref, ...match } = mt;
      await db.from("opportunities").update({ match: match as never, match_source: source }).eq("id", ref).eq("workspace_id", data.id);
    }
    return { source, notice, count: matches.length };
  });

/* ---------------------------- vision boards ------------------------- */

export const generateBoard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, opportunityId: uuid, sceneNote: z.string().trim().max(300).default("") }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertWorkspace(data.id);
    const db = await admin();
    const [{ data: opp }, { data: stories }, { data: analysis }] = await Promise.all([
      db.from("opportunities").select("id, title, company, match").eq("id", data.opportunityId).eq("workspace_id", data.id).maybeSingle(),
      db.from("stories").select("kind, title").eq("workspace_id", data.id),
      db.from("analyses").select("result").eq("workspace_id", data.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!opp) throw new Error("Opportunity not found");

    const interests = (stories ?? []).filter((s) => s.kind === "interest").map((s) => s.title);
    const projects = (stories ?? []).filter((s) => s.kind !== "interest").map((s) => s.title).slice(0, 3);
    const caps = ((analysis?.result as unknown as AnalysisResult | undefined)?.capabilities ?? []).slice(0, 4).map((c) => c.name);
    const role = opp.title.replace(/\(sample listing\)/i, "").trim();

    const prompt = [
      `An aspirational, cinematic vision-board image of a person thriving in a possible future as: ${role}.`,
      caps.length ? `They are visibly using these strengths: ${caps.join(", ")}.` : "",
      projects.length ? `Subtle visual nods to their past: ${projects.join("; ")}.` : "",
      interests.length ? `Personal touches from their interests: ${interests.join(", ")}.` : "",
      data.sceneNote ? `Scene detail: ${data.sceneNote}.` : "",
      "Painterly editorial photography, warm golden light, midnight indigo, plum and lavender palette with champagne-gold accents, hopeful mood. No text, no logos, no words.",
    ]
      .filter(Boolean)
      .join(" ");

    const m = await meta();
    let b64: string;
    try {
      b64 = await m.museImage(prompt);
    } catch (e) {
      if (e instanceof m.MetaUnavailableError) {
        throw new Error("Muse Image is unavailable right now, so no board was generated. Please try again shortly.");
      }
      throw e;
    }
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${data.id}/boards/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
    if (upErr) throw new Error("The image was generated but could not be stored");

    const { data: row, error } = await db
      .from("vision_boards")
      .insert({
        workspace_id: data.id,
        opportunity_id: opp.id,
        title: role,
        prompt,
        image_url: `storage:${path}`,
        source: "meta_live",
        saved: false,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save the board");
    return { boardId: row.id };
  });

export const updateBoard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, boardId: uuid, saved: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("vision_boards").update({ saved: data.saved }).eq("id", data.boardId).eq("workspace_id", data.id);
    return { ok: true };
  });

export const deleteBoard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: uuid, boardId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: b } = await db.from("vision_boards").select("image_url").eq("id", data.boardId).eq("workspace_id", data.id).maybeSingle();
    if (b?.image_url.startsWith("storage:")) await db.storage.from(BUCKET).remove([b.image_url.slice(8)]);
    await db.from("vision_boards").delete().eq("id", data.boardId).eq("workspace_id", data.id);
    return { ok: true };
  });

/* ---------------------------- proof lab ----------------------------- */

const num = z.coerce.number().min(0).max(100000);

export const submitExperiment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid,
        inputs: z.object({
          sheets_used: num,
          tape_cm: num,
          height_cm: num,
          load_g: num,
          hold_seconds: num,
          iterations: num,
          build_minutes: num,
          reflection: z.string().max(1500).default(""),
        }),
        photoDataUrl: z
          .string()
          .max(4_000_000)
          .regex(/^data:image\/(jpeg|png|webp);base64,/)
          .nullable(),
        structurePrompt: z.string().trim().min(2).max(60).default("paper tower"),
        loadPrompt: z.string().trim().max(60).nullable(),
        manualChecks: z.array(z.string().max(200)).max(10).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await assertWorkspace(data.id);
    const db = await admin();
    const score = scorePaperChallenge(data.inputs);

    let photoPath: string | null = null;
    if (data.photoDataUrl) {
      const [head, b64] = data.photoDataUrl.split(",");
      const type = head.match(/image\/(\w+)/)?.[1] ?? "jpeg";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `${data.id}/proof/${crypto.randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: `image/${type}` });
      if (!error) photoPath = `storage:${path}`;
    }

    let evidence_mode: "sam" | "manual" = "manual";
    let segmentation: SegmentationEvidence | { manual_checks: string[]; note?: string } = {
      manual_checks: data.manualChecks,
    };
    let notice: string | null = null;

    if (data.photoDataUrl) {
      const m = await meta();
      try {
        const structText = await m.samSegment(data.photoDataUrl, data.structurePrompt);
        const loadText = data.loadPrompt ? await m.samSegment(data.photoDataUrl, data.loadPrompt) : "";
        const structure_boxes = parseSamBoxes(structText);
        const load_boxes = parseSamBoxes(loadText);
        segmentation = {
          model: m.META_MODELS.sam,
          structure_prompt: data.structurePrompt,
          load_prompt: data.loadPrompt || null,
          structure_boxes,
          load_boxes,
          observations: describeSegmentation(structure_boxes, load_boxes, data.structurePrompt, data.loadPrompt || null),
        };
        evidence_mode = "sam";
      } catch (e) {
        if (!(e instanceof m.MetaUnavailableError)) throw e;
        notice = "Photo analysis was unavailable, so your manual checklist was recorded instead.";
        segmentation = { manual_checks: data.manualChecks, note: "SAM 3.1 unavailable at submission time." };
      }
    }

    const { data: row, error } = await db
      .from("experiments")
      .insert({
        workspace_id: data.id,
        challenge: "paper_structure",
        inputs: data.inputs as never,
        score: score as never,
        evidence_mode,
        segmentation: segmentation as never,
        photo_url: photoPath,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not save your result");
    return { experimentId: row.id, evidence_mode, notice };
  });
