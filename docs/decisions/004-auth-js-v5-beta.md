# 004 — Running Auth.js v5 while it is still beta

**Status**: accepted · **Date**: 2026-07-27 · **Milestone**: 0 (Slice 3)

## Context

`next-auth` publishes `4.24.15` as `latest` and `5.0.0-beta.32` as `beta`. After the
version audit in ADR 003 moved everything else to a stable or LTS line, Auth.js v5 is the
only remaining pre-release dependency in the project. Shipping a beta deserves an explicit
decision rather than inheriting one.

## Options considered

1. **Auth.js v5 beta** — what the stack was locked to.
2. **Auth.js v4 stable** — the only literally-stable Auth.js release.
3. **Better Auth 1.6.25** — a genuinely stable 1.x alternative with a Drizzle adapter.

## Decision

Stay on **`next-auth@5.0.0-beta.32`**.

"Beta" here does not mean what the tag usually implies. v5 has been the recommended path
for the App Router for years, is widely deployed in production, and its published peer
range explicitly names `next: ^16.0.0` — so Next 16 support is a stated commitment, not an
accident. The version number is behind the reality of its adoption.

Option 2 is stable in name only. v4 predates the App Router: it expects `getServerSession`
and a Pages-router API route, so every protected Server Component would need a shim. That
trades a well-understood beta for friction on every route we write — worse in practice, not
safer.

Option 3 was the closest call. Better Auth is genuinely 1.x and actively maintained, and
under a strict reading of "prefer stable" it wins. It was declined because the tech stack is
locked to Auth.js, the schema in `lib/db/schema.ts` is already built to
`@auth/drizzle-adapter`'s exact column contract, and swapping auth libraries to improve a
version number — while the beta has no known blocking defect — is churn rather than
engineering.

## Consequences

- The dependency is pinned to the exact beta build, not a range. A caret on a `beta` tag
  would silently pull `beta.33`, and pre-release versions carry no compatibility promise
  between builds.
- Auth logic stays behind our own module boundary (`auth.ts` plus session helpers) rather
  than importing `next-auth` throughout the app. Route handlers and Server Components
  depend on our helpers, not on the library's surface directly. This is the same seam
  reasoning applied to `lib/ai/provider.ts` for the model provider.
- **Exit path**, if v5 stalls or a blocking bug appears: the adapter tables are standard
  (`users`, `accounts`, `sessions`, `verification_tokens`) and Better Auth's Drizzle adapter
  uses a near-identical shape, so a migration would be a schema rename plus rewiring the
  module boundary above — not a rewrite of every consumer.
- Revisit at the Milestone 3 boundary, per the ADR 003 cadence.
