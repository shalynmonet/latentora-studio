import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UserRound, FlaskConical } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResultSource } from "@/lib/types";
import { startWorkspace, statusQuery, setWorkspaceId, useWorkspace } from "@/lib/workspace";
import sampleBoard1 from "@/assets/sample-board-1.jpg";
import sampleBoard2 from "@/assets/sample-board-2.jpg";
import logoIcon from "@/assets/latentora_icon.png.asset.json";
import logoName from "@/assets/latentora_name.png.asset.json";

export const ASSET_IMAGES: Record<string, string> = {
  "asset:sample-board-1": sampleBoard1,
  "asset:sample-board-2": sampleBoard2,
};
export const resolveImage = (url: string) => ASSET_IMAGES[url] ?? url;

export const JOURNEY = [
  { to: "/discover", label: "Discover", sub: "My Story" },
  { to: "/explore", label: "Explore", sub: "Opportunity Radar" },
  { to: "/visualize", label: "Visualize", sub: "Possibility Studio" },
  { to: "/experiment", label: "Experiment", sub: "Proof Lab" },
  { to: "/evolve", label: "Evolve", sub: "Capability Atlas" },
] as const;

export function SourceBadge({ source, model }: { source: ResultSource | null | undefined; model?: string | null }) {
  if (source === "meta_live")
    return (
      <Badge variant="live" title="Generated live by Meta Model API">
        <span className="size-1.5 rounded-full bg-success" /> Live · {model ?? "Meta"}
      </Badge>
    );
  if (source === "demo_sample") return <Badge variant="sample">Sample data · not live Meta output</Badge>;
  if (source === "offline_heuristic") return <Badge variant="heuristic">Offline keyword scan · not Meta output</Badge>;
  return null;
}

export function SiteHeader() {
  const { data: status } = useQuery(statusQuery);
  const { data } = useWorkspace();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Latentora home">
          <img src={logoIcon.url} alt="" width={36} height={36} className="size-9" />
          <img src={logoName.url} alt="Latentora" width={130} height={30} className="h-[18px] w-auto" />
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Journey">
          {JOURNEY.map((s, i) => (
            <Link
              key={s.to}
              to={s.to}
              className="group rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "bg-accent/50 text-foreground" }}
            >
              <span className="mr-1.5 text-[0.65rem] text-gold/70">0{i + 1}</span>
              {s.label}
            </Link>
          ))}
          <Link
            to="/made-for-me"
            className="ml-2 rounded-full border border-gold/40 px-3 py-1.5 text-sm text-gold transition-colors hover:bg-gold/10"
            activeProps={{ className: "bg-gold/15" }}
          >
            Made for Me
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {data?.workspace.is_demo && <Badge variant="sample">Demo profile</Badge>}
          {status && (
            <Badge variant={status.metaConfigured ? "live" : "sample"} className="hidden sm:inline-flex">
              {status.metaConfigured ? "Meta API connected" : "Demo mode"}
            </Badge>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden" aria-label="Journey (mobile)">
        {JOURNEY.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="shrink-0 rounded-full px-3 py-1 text-xs text-muted-foreground"
            activeProps={{ className: "bg-accent/50 text-foreground" }}
          >
            {s.label}
          </Link>
        ))}
        <Link
          to="/made-for-me"
          className="shrink-0 rounded-full border border-gold/40 px-3 py-1 text-xs text-gold"
          activeProps={{ className: "bg-gold/15" }}
        >
          Made for Me
        </Link>
      </nav>
    </header>
  );
}

export function PageIntro({ step, title, sub, children }: { step: number; title: ReactNode; sub: string; children?: ReactNode }) {
  return (
    <div className="animate-rise mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-3">
          0{step} · {JOURNEY[step - 1]?.label} — {JOURNEY[step - 1]?.sub}
        </p>
        <h1 className="text-5xl leading-[1.02] md:text-6xl">{title}</h1>
        <p className="mt-4 text-base text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("glass rounded-3xl p-6 md:p-8", className)}>{children}</section>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <h3 className="text-3xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-6 flex justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading your constellation…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground" role="status">
      <Loader2 className="size-5 animate-spin text-gold" /> {label}
    </div>
  );
}

/** Ensures a workspace exists; otherwise offers to start fresh or load the demo profile. */
export function WorkspaceGate({ children }: { children: (ws: NonNullable<ReturnType<typeof useWorkspace>["data"]>, refresh: () => void, id: string) => ReactNode }) {
  const { id, data, isLoading, error, refresh } = useWorkspace();
  if (isLoading) return <Loading />;
  if (error)
    return (
      <EmptyState
        title="We couldn't reach your workspace"
        body="Check your connection and try again."
        action={<Button onClick={() => refresh()}>Try again</Button>}
      />
    );
  if (!id || !data) return <StartChoices />;
  return <>{children(data, refresh, id)}</>;
}

export function StartChoices({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<"me" | "demo" | null>(null);
  const start = async (demo: boolean) => {
    setBusy(demo ? "demo" : "me");
    try {
      await startWorkspace(demo);
      toast.success(demo ? "Demo profile loaded — sample data is clearly labelled." : "Your workspace is ready.");
    } catch {
      toast.error("Couldn't create a workspace. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", compact ? "" : "mx-auto max-w-3xl")}>
      <button
        onClick={() => start(false)}
        disabled={busy !== null}
        className="glass group rounded-3xl p-7 text-left transition-all hover:-translate-y-1 hover:shadow-glow disabled:opacity-60"
      >
        <UserRound className="mb-4 size-6 text-gold" />
        <h3 className="text-3xl">Begin with my story</h3>
        <p className="mt-2 text-sm text-muted-foreground">Start an empty, private workspace saved to this browser.</p>
        {busy === "me" && <Loader2 className="mt-3 size-4 animate-spin" />}
      </button>
      <button
        onClick={() => start(true)}
        disabled={busy !== null}
        className="glass group rounded-3xl p-7 text-left transition-all hover:-translate-y-1 hover:shadow-glow disabled:opacity-60"
      >
        <FlaskConical className="mb-4 size-6 text-lavender" />
        <h3 className="text-3xl">Explore the demo profile</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          For judges: “Maya”, a night-shift baker, with clearly labelled sample results you can re-run live.
        </p>
        {busy === "demo" && <Loader2 className="mt-3 size-4 animate-spin" />}
      </button>
    </div>
  );
}

export function WorkspaceSwitcher() {
  const { data } = useWorkspace();
  if (!data) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span>
        Workspace: <span className="text-foreground">{data.workspace.display_name}</span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (confirm("Leave this workspace on this browser? You can start a new one or load the demo.")) setWorkspaceId(null);
        }}
      >
        Switch workspace
      </Button>
    </div>
  );
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>, errMsg = "Something went wrong"): Promise<T | undefined> => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : errMsg);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Downscales an uploaded image in the browser and returns a JPEG data URL. */
export async function resizeImage(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
