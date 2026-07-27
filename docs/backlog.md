# Backlog

Parking lot for anything that isn't in the current milestone. No scope creep: ideas land
here, not in the current branch.

## Deferred from Milestone 0

- **`/sign-in` and `/demo` routes.** The landing page CTAs point at these; they are built
  in Slice 3 (Auth.js + guest mode). Until then both 404. Tracked so it is a known gap,
  not a surprise.
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

- **Free-tier training disclosure.** Gemini's free tier states content is used to improve
  Google's products. The upload UI must say so plainly — see
  `docs/decisions/002-embedding-model-and-dimension.md`.

## Ideas (unscheduled)

- Bundle-size budget enforced in CI for the chat route (quality bar #6).
- Lighthouse CI as a PR gate rather than a manual measurement.
