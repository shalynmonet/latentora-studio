import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Camera, Loader2, RefreshCw, Sparkles, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageIntro, Panel, SourceBadge, WorkspaceGate, resizeImage, resolveImage, useBusy } from "@/components/latentora/shared";
import { deleteBoard, generateBoard, updateBoard } from "@/lib/latentora.functions";
import type { VisionBoard, WorkspaceData } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/visualize")({
  validateSearch: z.object({ opp: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Visualize — Possibility Studio · Latentora" },
      { name: "description", content: "Generate personalised vision boards of possible futures with Meta Muse Image." },
      { property: "og:title", content: "Visualize — Possibility Studio · Latentora" },
      { property: "og:description", content: "See yourself inside a future you haven't imagined yet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VisualizePage,
});

function VisualizePage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14">
      <PageIntro
        step={3}
        title={
          <>
            Step inside a <em className="text-gold-gradient">possible</em> future
          </>
        }
        sub="Choose an opportunity, optionally add a photo of yourself, and Muse Image paints you exploring it, drawing on your stories and interests. These are imagined possibilities — not predictions, and not achievements."
      />
      <WorkspaceGate>{(ws, refresh, id) => <Studio ws={ws} refresh={refresh} id={id} />}</WorkspaceGate>
    </div>
  );
}

function Studio({ ws, refresh, id }: { ws: WorkspaceData; refresh: () => void; id: string }) {
  const { opp } = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(opp ?? ws.opportunities[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "saved">("all");
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gen = useBusy();

  useEffect(() => {
    if (opp) setSelected(opp);
  }, [opp]);

  if (ws.opportunities.length === 0)
    return (
      <EmptyState
        title="Pick a future first"
        body="Add at least one opportunity to your radar, then come back to visualise it."
        action={
          <Button asChild>
            <Link to="/explore">Go to Opportunity Radar</Link>
          </Button>
        }
      />
    );

  const generate = async (opportunityId: string) => {
    const r = await gen.run(() => generateBoard({ data: { id, opportunityId, sceneNote: note, photoDataUrl: photo } }));
    if (r) {
      toast.success("A new possibility has been imagined.");
      refresh();
    }
  };

  const boards = ws.boards.filter((b) => filter === "all" || b.saved);
  const latest = ws.boards.find((b) => b.source === "meta_live");

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        <Panel>
          <h2 className="text-3xl">Compose</h2>
          <p className="mt-1 text-sm text-muted-foreground">One image per click — Muse Image is only called when you ask.</p>
          <div className="mt-5 space-y-2" role="radiogroup" aria-label="Opportunity">
            {ws.opportunities.map((o) => (
              <button
                key={o.id}
                role="radio"
                aria-checked={selected === o.id}
                onClick={() => setSelected(o.id)}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left transition-colors",
                  selected === o.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/40",
                )}
              >
                <p className="text-sm font-medium">{o.title}</p>
                <p className="text-xs text-muted-foreground">{o.company}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-1.5">
            <Label htmlFor="note">Add a scene detail (optional)</Label>
            <Textarea id="note" rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. by the sea, with my dog, at golden hour" />
          </div>
          <div className="mt-5 space-y-2">
            <Label>Put yourself in the picture (optional)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setPhoto(await resizeImage(f, 1024));
                } catch {
                  toast.error("Couldn't read that image.");
                }
              }}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-gold/40 hover:border-gold"
                aria-label={photo ? "Change your photo" : "Upload a photo of yourself"}
              >
                {photo ? <img src={photo} alt="Your photo" className="size-full object-cover" /> : <Camera className="size-5 text-gold" />}
              </button>
              <div className="text-xs text-muted-foreground">
                {photo ? (
                  <>
                    Muse Image will use this photo to show <span className="text-foreground">you</span> in the scene.{" "}
                    <button type="button" className="underline hover:text-foreground" onClick={() => setPhoto(null)}>
                      Remove
                    </button>
                  </>
                ) : (
                  "Upload a clear photo of your face. Without one, an imagined person is shown instead."
                )}
                <p className="mt-1">Your photo is sent to Meta only to make the picture and isn't saved here.</p>
              </div>
            </div>
          </div>
          <Button size="lg" className="mt-5 w-full" disabled={!selected || gen.busy} onClick={() => selected && generate(selected)}>
            {gen.busy ? (
              <>
                <Loader2 className="animate-spin" /> Muse Image is painting…
              </>
            ) : (
              <>
                <Sparkles /> Generate vision board
              </>
            )}
          </Button>
        </Panel>

        <div className="glass relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-3xl">
          {gen.busy ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground" role="status">
              <div className="size-16 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
              Imagining… this usually takes 10–20 seconds.
            </div>
          ) : latest ? (
            <BoardImage b={latest} large />
          ) : (
            <p className="px-8 text-center text-muted-foreground">Your newest Muse Image board will appear here.</p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-4xl">Gallery of possibilities</h2>
          <div className="flex gap-1 rounded-full border border-border p-1">
            {(["all", "saved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn("rounded-full px-3 py-1 text-xs capitalize", filter === f ? "bg-accent text-foreground" : "text-muted-foreground")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No boards here yet.</p>
        ) : (
          <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
            {boards.map((b) => (
              <figure key={b.id} className="glass mb-5 break-inside-avoid overflow-hidden rounded-3xl">
                <BoardImage b={b} />
                <figcaption className="space-y-3 p-5">
                  <p className="font-display text-xl">{b.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <SourceBadge source={b.source} model="muse-image-1.0" />
                    {b.from_photo && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-lavender/40 px-2.5 py-0.5 text-[0.7rem] text-lavender">
                        <UserRound className="size-3" /> From your photo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await updateBoard({ data: { id, boardId: b.id, saved: !b.saved } });
                        refresh();
                      }}
                    >
                      {b.saved ? <BookmarkCheck /> : <Bookmark />} {b.saved ? "Saved" : "Save"}
                    </Button>
                    {b.opportunity_id && (
                      <Button size="sm" variant="outline" disabled={gen.busy} onClick={() => generate(b.opportunity_id!)}>
                        <RefreshCw /> Regenerate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete board"
                      onClick={async () => {
                        await deleteBoard({ data: { id, boardId: b.id } });
                        refresh();
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BoardImage({ b, large = false }: { b: VisionBoard; large?: boolean }) {
  return (
    <div className="relative w-full">
      <img
        src={resolveImage(b.image_url)}
        alt={`Imagined possibility: ${b.title}`}
        loading={large ? "eager" : "lazy"}
        width={1536}
        height={1024}
        className={cn("w-full object-cover", large && "h-full max-h-[560px]")}
      />
      <span className="absolute left-3 top-3 rounded-full bg-background/70 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-gold backdrop-blur">
        {b.source === "demo_sample" ? "Sample illustration · imagined" : "Imagined possibility · not a prediction"}
      </span>
    </div>
  );
}
