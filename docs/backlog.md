# Backlog

Parking lot for anything that isn't in the current milestone. No scope creep: ideas land
here, not in the current branch.

## Deferred from Milestone 0

- **Email magic-link sign-in.** CLAUDE.md specifies magic link alongside GitHub OAuth.
  Deferred from Slice 3 because it needs an email-sending account (Resend or similar) that
  does not exist yet, and GitHub OAuth plus guest mode already satisfies the milestone's
  exit criteria. The Auth.js provider is a few lines once a sender is configured; the
  `verification_tokens` table it needs is already migrated.
- **Coverage thresholds in `vitest.config.ts`.** Quality bar #4 sets ≥90% for `lib/rag`
  and `lib/ai`. Both directories arrive in Milestone 1; the threshold gets switched on
  with them, since a threshold over an empty tree passes vacuously.
- **HNSW index on `chunks.embedding`.** Dimension is now settled at 768
  (`docs/decisions/002-embedding-model-and-dimension.md`); the index itself is built in
  Milestone 1 alongside the first real retrieval query.
- **Upgrade to TypeScript 7 / ESLint 10.** Blocked upstream — see
  `docs/decisions/001-pin-typescript-5-and-eslint-9.md`.

## Open decisions

- **Generation provider — deliberately deferred to Milestone 2.** Embeddings are settled
  (Gemini, 768d). The chat model is not, and does not need to be: the Vercel AI SDK
  abstracts providers, so the choice is cheap to defer and gets better with information.
  The commitment made now is structural, not vendor-specific — **all provider selection
  goes through a single `lib/ai/provider.ts` module**, so switching is one file, not a
  refactor. Candidates when the time comes: Gemini Flash-Lite (already have the key),
  Groq, or OpenRouter free variants. Decide by A/B-ing answer quality on real uploaded
  documents rather than on reputation.

- **Per-session cap for guest mode.** Not a quota-exhaustion worry — free-tier Flash-Lite
  allows roughly 1,000–1,500 requests/day, and a guest session of ~5 questions means
  200–300 sessions/day, far beyond what a portfolio demo sees organically. The real
  exposure is a bot or a single abusive visitor. So the guard is a per-session/IP cap plus
  a graceful "demo limit reached" state — _not_ keeping the demo switched off, which would
  break the cold-link scenario the roadmap's Milestone 5 exit criteria depend on. Folds
  into Milestone 3 rate limiting; may want a cheap guard as soon as guest mode is live.

- **Verify the EEA data-protection exception against the real account.** Google grants
  paid-service data terms — no training on prompts or uploaded files — to customers in the
  EEA, Switzerland and the UK even on unpaid quota. That removes the training-disclosure
  obligation previously recorded here, but it follows the account's billing region rather
  than the plan. Confirm it in the Google account before stating anything to a user, and
  re-check if billing ever moves. See
  `docs/decisions/002-embedding-model-and-dimension.md` and
  `docs/decisions/007-commercial-optionality.md`.

## Only if it earns money

Deliberately not built yet — see `docs/decisions/007-commercial-optionality.md` for why
each of these is reversible and therefore safe to defer.

- **Vercel Pro ($20/mo).** Hobby is restricted to non-commercial personal use, so the first
  paying customer makes the current plan a terms violation. A billing page, not a migration.
- **Privacy policy, terms of service, sub-processor list, DPA.** Required before taking
  money from EU customers; easier to write once the product's real data flows exist.
- **Cross-tenant leakage test in CI.** The isolation rule is already mandated in
  CLAUDE.md; what is missing is a test that fails loudly if a query ever forgets its
  workspace scope. Worth adding as soon as `lib/rag` has queries to guard.

## Ideas (unscheduled)

- **UUIDv7 primary keys instead of UUIDv4.** Postgres 18 ships a native `uuidv7()`.
  The schema currently uses Drizzle's `defaultRandom()`, which is `gen_random_uuid()`
  (v4, fully random), so every insert lands at a random point in the primary key's
  B-tree. v7 is time-ordered and gives sequential inserts — meaningful for `chunks`,
  where one PDF bulk-inserts several hundred rows. Deferred because it pins the schema
  to Postgres 18 specifically, and the gain is unmeasured at portfolio data volumes.
  Worth benchmarking during Milestone 1 ingestion work rather than assuming.

- Bundle-size budget enforced in CI for the chat route (quality bar #6).
- Lighthouse CI as a PR gate rather than a manual measurement.
