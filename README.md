# Latentora

**Discover the future you haven't imagined yet.**

Latentora is an AI-powered human potential discovery platform. It helps people uncover hidden transferable abilities, find real opportunities, visualise possible futures, and test themselves with practical experiments.

**DISCOVER → EXPLORE → VISUALIZE → EXPERIMENT → EVOLVE**

| Step | Page | What happens | Engine |
|---|---|---|---|
| Discover | `/discover` – My Story | User adds 3+ stories; capabilities are split into *evidenced in your stories* vs *AI hypotheses*, plus transferable skills, connections and things worth testing | Meta **Muse Spark** (`muse-spark-1.3`) |
| Explore | `/explore` – Opportunity Radar | Live remote jobs from Remotive's public API, or pasted Upwork/Twine briefs; matched on transferable ability with fit, evidence, missing qualifications and original link | Remotive API + **Muse Spark** |
| Visualize | `/visualize` – Possibility Studio | One-click personalised vision board for a chosen opportunity; save, regenerate, delete. Always labelled "imagined possibility" | Meta **Muse Image** (`muse-image-1.0`) |
| Experiment | `/experiment` – Proof Lab | Paper Structure Challenge: measurements scored by deterministic TypeScript rules; optional photo analysed by SAM; manual self-reported checklist fallback | Meta **SAM 3.1** (`sam-3.1`) |
| Evolve | `/evolve` – Capability Atlas | Interactive constellation of evidenced / hypothesised / tested capabilities, and which matched opportunities are now backed by test evidence | Deterministic (no AI) |

## How Meta models are used

All calls go to `https://api.meta.ai/v1` from server functions only (`src/lib/meta.server.ts`). The key is read from the backend secret **`MODEL_API_KEY`** and never reaches the browser.

- **Muse Spark** – `POST /v1/chat/completions` with `response_format: json_schema` (constrained decoding) and `reasoning_effort: "low"` to keep costs down. Used for story analysis and batched opportunity matching (up to 8 listings per call).
- **Muse Image** – `POST /v1/images/generations`, `n: 1`, `size: 1536x1024`, JPEG, `reasoning_strength: "low"`, web/image search and shell tools disabled. Only called when the user clicks *Generate* (~$0.01/image). Images are stored in private file storage and served via signed links.
- **SAM 3.1** – `POST /v1/responses` with an `input_text` concept ("paper tower", "book") and an `input_image` data URL, `metadata.include_confidence: "true"`. Only box tokens are parsed (`src/lib/sam-parse.ts`); observations are limited to what boxes show (count, aspect ratio, whether the load sits on top). SAM never decides strength or weight.

Model IDs were verified against `GET /v1/models` for this account.

## Honesty rules

- Every AI result carries a source badge: **Live · model**, **Sample data · not live Meta output**, or **Offline keyword scan · not Meta output**.
- No numeric confidence scores. Capabilities are backed by quoted story evidence or measured Proof Lab criteria.
- Opportunities are never fabricated: live jobs come from Remotive (with attribution and link-back; responses cached 12h per query, per Remotive's request of ≤4 calls/day). If the feed is down, clearly labelled sample listings are shown.

## Demo mode & demo profile

- **Demo profile for judges** – "Explore the demo profile" on the home page creates a workspace for *Maya Okafor*, a night-shift baker, with sample analysis, sample listings and two bundled sample illustrations — all labelled as sample data. Any step can be re-run live.
- **If the Meta API is unavailable** – Discover and matching fall back to an offline keyword heuristic (labelled), Proof Lab records the manual checklist, and Muse Image shows a clear error instead of a fake image.

## Architecture

- TanStack Start (React 19, TypeScript, Vite) + Tailwind CSS v4 design tokens in `src/styles.css`.
- Server logic in `createServerFn` functions (`src/lib/latentora.functions.ts`) running on the edge.
- Lovable Cloud database tables: `workspaces`, `stories`, `analyses`, `opportunities`, `vision_boards`, `experiments`, `job_cache`. Row-level security is on with no public policies; only server functions (service role) read/write.
- No sign-in: each browser holds a random workspace id; anyone with that id can access the workspace.
- Private storage bucket `latentora-media` for generated boards and Proof Lab photos.
- Deterministic logic with tests: `src/lib/scoring.ts`, `src/lib/sam-parse.ts`, `src/lib/atlas.ts` → `bunx vitest run`.

## Setup

1. Add the `MODEL_API_KEY` backend secret (Meta Model API key).
2. Publish. No other paid services are required.
