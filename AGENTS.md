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
- Proof Lab scoring and Atlas status changes are deterministic TypeScript (`scoring.ts`, `atlas.ts`) with tests in `src/lib/scoring.test.ts`; SAM output only contributes observations. Why: no fabricated or AI-inferred physical claims.
- Media goes to the private `latentora-media` bucket as `storage:<path>` and is signed on read; bundled demo images use `asset:<name>`. Why: workspace policy blocks public buckets.
- Remotive results are cached per query in `job_cache` for 12h. Why: Remotive asks for at most ~4 requests per day.
