// Server-only: the one read path for "what Latentora knows about this person's capabilities".
// Story analysis + approved résumé findings, merged by the deterministic rules in resume-rules.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { approvedCapabilities, mergeResumeIntoAnalysis } from "./resume-rules";
import type { Analysis, ResumeRecord } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export async function loadResume(db: Db, workspaceId: string): Promise<ResumeRecord | null> {
  const { data } = await db
    .from("resumes")
    .select("id, file_name, file_kind, source, model, quotes_checked, result, review, reviewed_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as ResumeRecord) ?? null;
}

export async function loadEffectiveAnalysis(db: Db, workspaceId: string): Promise<{ analysis: Analysis | null; resume: ResumeRecord | null }> {
  const [{ data: a }, resume] = await Promise.all([
    db.from("analyses").select("id, source, model, result, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadResume(db, workspaceId),
  ]);
  const caps = resume ? approvedCapabilities(resume.result, resume.review ?? {}) : [];
  const analysis = mergeResumeIntoAnalysis((a as unknown as Analysis) ?? null, caps, resume);
  return { analysis, resume };
}
