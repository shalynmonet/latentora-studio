import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceGate, WorkspaceSwitcher } from "@/components/latentora/shared";
import { MadeForMeFlow } from "@/components/made-for-me/flow";

export const Route = createFileRoute("/made-for-me/")({
  validateSearch: (s: Record<string, unknown>): { i?: string } =>
    typeof s["i"] === "string" && /^[0-9a-f-]{36}$/i.test(s["i"]) ? { i: s["i"] } : {},
  head: () => ({
    meta: [
      { title: "Made for Me — Personal tools you haven't imagined yet · Latentora" },
      {
        name: "description",
        content: "Latentora discovers what could make your life easier or your ambitions more achievable, then designs a personal tool and a copy-ready build prompt just for you.",
      },
      { property: "og:title", content: "Made for Me — What if the tool you need doesn't exist yet?" },
      { property: "og:description", content: "A personal invention atelier: three tools designed around your strengths, preferences and goals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MadeForMePage,
});

function MadeForMePage() {
  const { i } = Route.useSearch();
  return (
    <div className="mx-auto max-w-7xl px-5 py-14">
      {!i && (
        <header className="relative mb-14">
          <div className="pointer-events-none absolute -left-20 -top-10 -z-10 size-80 rounded-full bg-plum/40 blur-3xl" />
          <p className="eyebrow motion-safe:animate-rise">Made for Me · Personal tools for possibilities you haven't imagined yet</p>
          <h1 className="mt-5 max-w-4xl text-5xl leading-[0.98] motion-safe:animate-rise md:text-7xl">
            What if the tool you need <em className="text-gold-gradient">doesn't exist yet?</em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground motion-safe:animate-rise">
            Latentora discovers what could make your life easier, your ambitions more achievable and your possibilities bigger... Then
            designs it specifically for you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href="#start">
                Discover What I Need <ArrowRight />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/made-for-me/demo">
                <Users /> Same Ambition. Different Humans. (Demo)
              </Link>
            </Button>
          </div>
          <p className="mt-6 max-w-2xl text-xs text-muted-foreground">
            Not a startup idea generator or a job board. You get a personal tool design and a ready-to-paste prompt for an AI app builder,
            built around what you've told Latentora.
          </p>
          <div className="mt-6">
            <WorkspaceSwitcher />
          </div>
        </header>
      )}
      <WorkspaceGate>{(_ws, _refresh, id) => <MadeForMeFlow workspaceId={id} inventionId={i} />}</WorkspaceGate>
    </div>
  );
}
