# 006 — Deployment topology: function region and connection pooling

**Status**: accepted · **Date**: 2026-07-27 · **Milestone**: 0 (Slice 4)

## Context

Deploying to Vercel with the database on Neon introduces two choices that are invisible
locally, because on a developer machine the app and the database are the same machine:

1. **Where the serverless functions execute**, relative to the database.
2. **Which connection string to use**, given Neon offers a pooled and a direct endpoint.

Both default to something that works, which is what makes them easy to miss.

## Decision 1 — pin the function region to `fra1`

Vercel defaults new projects to `iad1` (Washington DC). The Neon database is in
`eu-central-1` (Frankfurt), chosen to be near the developer. Left alone, every database
query would cross the Atlantic twice while the static assets were served correctly from a
European CDN edge — a split that looks fine in a browser and is invisible in local testing.

`vercel.json` sets `regions: ["fra1"]`. Vercel's documentation is explicit that this
overrides the dashboard setting, so the configuration lives in the repository where it is
reviewable and travels with the project rather than in a UI nobody diffs.

### Measured, not assumed

The first deployment happened to go out before `vercel.json` was merged, which gave a
genuine before/after pair. Median of five `curl` requests from a European vantage point:

| Route                              | `iad1` | `fra1` |          |
| ---------------------------------- | ------ | ------ | -------- |
| `/sign-in` — dynamic, no query     | 234 ms | 149 ms | −36%     |
| `/demo` — dynamic + database query | 395 ms | 134 ms | **−66%** |

The route that touches the database improved roughly twice as much as the one that does
not, which is the signature of round-trip latency rather than general slowness. Before the
change `/demo` was _slower_ than `/sign-in`; afterwards it is marginally faster, because a
colocated query costs almost nothing.

Diagnosing it needed no profiler: Vercel's `x-vercel-id` header reads `fra1::iad1::…` —
entered at the Frankfurt edge, executed in Washington. After the fix it reads `fra1::fra1::`.

## Decision 2 — pooled for the app, direct for migrations

Neon's pooled endpoint is PgBouncer in transaction mode. Neon's own documentation lists
schema migrations as a case it does not support, because DDL wants a stable session that a
transaction pooler will not give it.

So the two are split by workload rather than by environment:

- **`DATABASE_URL`** — pooled. The app. Serverless invocations open many short-lived
  connections, which is exactly what a pooler is for.
- **`DATABASE_URL_UNPOOLED`** — direct. `pnpm db:migrate` and `pnpm db:seed` only.

`DATABASE_URL_UNPOOLED` is Neon's own variable name, so their Vercel integration populates
it automatically. Both commands fall back to `DATABASE_URL` when it is unset, which is what
keeps local Docker and CI — neither of which has a pooler — working unchanged.

## Decision 3 — preview deployments never point at production

Vercel scopes environment variables per environment. Production variables point at the Neon
`main` branch; Preview points at the `dev` branch. `AUTH_SECRET` differs between them too:
it signs guest tokens, and sharing it would make a token minted on a throwaway preview
valid against production.

This matters more than it first appears, because `next build` evaluates route modules and
therefore _fails_ if `DATABASE_URL` is merely absent. The tempting fix — one variable scoped
to "Production and Preview" — is precisely what would let a pull-request preview write to
production data.

## Consequences

- One config line bought a 66% latency reduction on database-backed routes. This is the
  cheapest performance work in the project and it happened before any code was optimized.
- Vercel deploys Routing Middleware (`proxy.ts`) to all regions regardless of this setting.
  That is harmless only because the proxy reads cookies and never queries — the same
  constraint that kept `node:crypto` out of it. Were it to touch the database, global
  distribution would reintroduce exactly the latency this ADR removes.
- Milestone 3's TTFT measurements now have a sane baseline. Measuring streaming performance
  against a transatlantic database would have produced numbers describing geography rather
  than the application.
- Non-production URLs (deployment and branch aliases) sit behind Vercel's Deployment
  Protection and require a Vercel login, so only the production domain can be shared.
