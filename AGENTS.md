<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Latentora architecture rules
- All Meta Model API calls live in `src/lib/meta.server.ts` and are invoked only from server functions in `src/lib/latentora.functions.ts`; the key comes from the `MODEL_API_KEY` secret. Why: keeps the key server-side and API usage in one place.
- No sign-in: data is scoped by a random workspace id stored in localStorage; tables have RLS on with no policies and are accessed only via the service-role client inside server functions. Why: frictionless judging/demo while keeping the Data API closed.
- Every AI-derived record stores a `source` (`meta_live` | `demo_sample` | `offline_heuristic`) and the UI must show it. Why: never disguise sample or fallback output as live Meta results.
- Proof Lab scoring and Atlas status changes are deterministic TypeScript (`scoring.ts`, `challenge-rules.ts`, `atlas.ts`) with tests in `src/lib/scoring.test.ts`; Muse Spark may only propose designed-challenge specs, which `sanitizeSpec` validates before saving, and SAM output only contributes observations. Why: no fabricated or AI-inferred physical claims.
- Photos used for vision boards are sent to Muse Image `/images/edits` per request and never stored; boards record `from_photo`. Why: avoid keeping face photos.
- Media goes to the private `latentora-media` bucket as `storage:<path>` and is signed on read; bundled demo images use `asset:<name>`. Why: workspace policy blocks public buckets.
- Explore merges free public listing feeds (Remotive, Jobicy, Freelancer.com, OpenTrain) via `listings.server.ts` into one list; each source is cached per query in `job_cache` with its own window from `PROVIDERS` (Remotive 12h). Only official/public endpoints — no scraping or unofficial APIs (Upwork, Twine, Mercor stay paste-in). Why: respect source terms and Remotive's ~4 requests/day ask.
