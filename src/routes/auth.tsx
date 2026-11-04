import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/latentora/shared";
import { claimWorkspace } from "@/lib/account.functions";
import { setWorkspaceId } from "@/lib/workspace";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Save your profile · Latentora" },
      { name: "description", content: "Create a Latentora account to keep your stories, capabilities and inventions across devices." },
      { property: "og:title", content: "Save your profile · Latentora" },
      { property: "og:description", content: "Create an account to keep your Latentora profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const link = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const res = await claimWorkspace({ data: { localId: localStorage.getItem("latentora.workspace") } });
      setWorkspaceId(res.id);
      toast.success(res.linked ? "Your profile is now saved to your account." : "Signed in — your saved profile is loaded.");
      navigate({ to: "/discover", replace: true });
    };
    link().catch((e) => toast.error(e instanceof Error ? e.message : "Could not load your profile"));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") link().catch(() => {});
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-4xl text-gold-gradient">{mode === "signup" ? "Save your profile" : "Welcome back"}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your stories, résumé findings, Atlas and inventions are kept with your account, so you can return from any device.
        Whatever you've already added on this browser is saved to the new account.
      </p>
      <Panel className="mt-8 space-y-5">
        {sent ? (
          <p className="text-sm">Check your email and click the confirmation link to finish creating your account.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` });
            if (r.error) toast.error(r.error.message);
          }}
        >
          Continue with Google
        </Button>
        <button type="button" className="w-full text-center text-xs text-muted-foreground underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </Panel>
    </main>
  );
}
