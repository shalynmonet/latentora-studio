import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOURNEY, StartChoices } from "@/components/latentora/shared";
import { useWorkspace } from "@/lib/workspace";
import hero from "@/assets/hero-constellation.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Latentora — Discover the future you haven't imagined yet" },
      {
        name: "description",
        content:
          "Uncover hidden transferable abilities, find real opportunities, visualise possible futures and test yourself with practical experiments.",
      },
      { property: "og:title", content: "Latentora — Discover the future you haven't imagined yet" },
      {
        property: "og:description",
        content: "An AI-powered human potential discovery platform built on Meta Muse Spark, Muse Image and SAM 3.1.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STEP_COPY = [
  "Tell three stories. Muse Spark separates what you've shown from what it suspects.",
  "Real listings, matched on transferable ability — not job-title keywords.",
  "Muse Image paints you inside a possible future. Imagined, never predicted.",
  "Small measurable challenges, scored by rules, observed by SAM 3.1.",
  "A living constellation of demonstrated, hypothesised and tested capability.",
];

function Index() {
  const { data } = useWorkspace();
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <img
          src={hero}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />
        <div className="mx-auto max-w-7xl px-5 pb-32 pt-24 md:pb-44 md:pt-36">
          <p className="eyebrow animate-rise">Human potential, discovered</p>
          <h1 className="animate-rise mt-6 max-w-3xl text-6xl leading-[0.95] md:text-8xl">
            Discover the future <em className="text-aurora animate-shimmer">you haven't imagined</em> yet.
          </h1>
          <p className="animate-rise mt-6 max-w-xl text-lg text-muted-foreground">
            Latentora reads the story of what you've already done, finds the abilities hiding inside it, and shows you
            where they could take you.
          </p>
          <div className="animate-rise mt-10 flex flex-wrap gap-3">
            {data ? (
              <Button asChild size="lg">
                <Link to="/discover">
                  Continue your journey <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <a href="#begin">
                  Begin <ArrowRight />
                </a>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/evolve">See the Capability Atlas</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <p className="eyebrow">The journey</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Discover → Explore → Visualize → Experiment → Evolve</h2>
        <ol className="mt-12 grid gap-4 md:grid-cols-5">
          {JOURNEY.map((s, i) => (
            <li key={s.to}>
              <Link
                to={s.to}
                className="glass group flex h-full flex-col rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-glow"
              >
                <span className="font-display text-5xl text-gold-gradient">0{i + 1}</span>
                <span className="mt-4 text-2xl font-display">{s.label}</span>
                <span className="text-xs uppercase tracking-widest text-lavender">{s.sub}</span>
                <span className="mt-3 text-sm text-muted-foreground">{STEP_COPY[i]}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {!data && (
        <section id="begin" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-24">
          <h2 className="mb-8 text-center text-4xl">Where would you like to start?</h2>
          <StartChoices />
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="glass grid gap-6 rounded-3xl p-8 md:grid-cols-3">
          <div>
            <p className="eyebrow">Honest by design</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Every result carries its source: <span className="text-success">live Meta output</span>,{" "}
              <span className="text-warning">sample data</span>, or an{" "}
              <span className="text-lavender">offline keyword scan</span>.
            </p>
          </div>
          <div>
            <p className="eyebrow">Evidence over scores</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No invented confidence percentages. Capabilities are shown with the stories and measurements behind them.
            </p>
          </div>
          <div>
            <p className="eyebrow">Real opportunities</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Live listings come from Remotive's public feed with links back to the original — or paste any freelance brief.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
