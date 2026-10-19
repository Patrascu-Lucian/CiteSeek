# 060 — A real model on Preview, on the dev key

**Status**: accepted, 19 October 2026.

## Context

Preview had fake embeddings, no `CHAT_PROVIDER` (which means the real chat model) and no API key. It
could prove that a build deploys, never that an answer works: a question that cleared retrieval
failed at the model call. The 1.10.0 smoke test set a real provider and a key for the test and
removed them afterwards, and the backlog asked for a decision instead of a repeat.

1.11.0 is about what Gemini answers ([ADR 059](059-passages-per-answer-for-gemini.md)), so a release
whose only real-model check comes after the tag would check last the thing it changed.

## Options

- **A key in a Google project of its own.** Its own rate limits and its own usage, so Preview's spend
  is visible and capped apart from production's. It costs a third project with billing attached.
- **The dev key.** It already exists and can be revoked without touching production. But Gemini
  counts rate limits and usage per Google project, not per key, and the dev and prod keys are in one
  project, so Preview shares production's limits.
- **Fake throughout.** Free and consistent, but it proves the plumbing, not the answers, and moves
  the real-model check to production after the tag.

## Decision

**Preview carries the dev key, with real embeddings and the real chat model.** Set on 19 October 2026:
`GOOGLE_GENERATIVE_AI_API_KEY` is the dev key, `EMBEDDINGS_PROVIDER` is removed, and `CHAT_PROVIDER`
stays unset.

What keeps a key on Preview from being an open tap, each checked when it was set:

- **Vercel's Standard Protection.** A Preview URL asks for a login to the Vercel team before the page
  loads, so no stranger reaches the app at all. It does not affect the production domain.
- **The app's caps apply unchanged.** Nothing in the code is gated on `VERCEL_ENV`, and neither
  `USAGE_LIMITS` nor `PLAN_LIMITS`, the switches Playwright uses to turn them off, is set on Preview.
- **The worst case is a number.** Preview's database keeps its own counters, so past both of the
  above it adds one more global cap of 800 requests a day: about $0.22 a day by
  [ADR 025](025-paying-for-the-model-tier.md)'s arithmetic.

## Consequences

- Every release's smoke test runs the real model before the tag, with no environment change to make
  and then undo.
- The limits are shared: a burst on Preview, or an eval run on the dev key, draws on production's.
  At Tier 1 that has not caused a failure; it is recorded in `docs/backlog.md` rather than solved
  here.
- Preview's demo document has to be embedded with Gemini. A fixture seeded with the fake embedder
  reaches `ready`, and the seed keeps a `ready` fixture, so real query vectors would search fake
  ones. The smoke test's first answered question is the check.
- Revoking the dev key takes Preview down along with local development, not production.
