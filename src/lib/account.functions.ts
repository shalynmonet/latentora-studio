// Links a browser workspace to a signed-in account so the profile follows the person.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const claimWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ localId: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: owned } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (owned) return { id: owned.id as string, linked: false };
    if (data.localId) {
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("id, owner_id, is_demo")
        .eq("id", data.localId)
        .maybeSingle();
      if (ws && !ws.owner_id && !ws.is_demo) {
        await supabaseAdmin.from("workspaces").update({ owner_id: userId }).eq("id", ws.id);
        return { id: ws.id as string, linked: true };
      }
    }
    const { data: created, error } = await supabaseAdmin
      .from("workspaces")
      .insert({ owner_id: userId, display_name: "My profile" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string, linked: false };
  });
