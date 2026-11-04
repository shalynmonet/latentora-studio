import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { setWorkspaceId } from "@/lib/workspace";

export function AccountButton() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const qc = useQueryClient();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (email === undefined) return null;
  if (!email)
    return (
      <Button asChild size="sm" variant="outline" className="rounded-full">
        <Link to="/auth">Save profile</Link>
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="ghost"
      title={email}
      onClick={async () => {
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        setWorkspaceId(null);
      }}
    >
      Sign out
    </Button>
  );
}
