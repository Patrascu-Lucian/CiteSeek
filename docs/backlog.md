# Backlog

Parking lot for anything that isn't in the current milestone. No scope creep: ideas land
here, not in the current branch.

## Deferred from Milestone 0

- **Email magic-link sign-in.** Planned alongside GitHub OAuth.
  Deferred from Slice 3 because it needs an email-sending account (Resend or similar) that
  does not exist yet, and GitHub OAuth plus guest mode already satisfies the milestone's
  exit criteria. The Auth.js provider is a few lines once a sender is configured; the
  `verification_tokens` table it needs is already migrated.
- **Coverage thresholds in `vitest.config.ts`.** ~~The bar is ≥90% for `lib/rag` and
  `lib/ai`.~~ Done in Milestone 1 — both thresholds are enforced now that the directories
  have real content.
- ~~**HNSW index on `chunks.embedding`.**~~ Already done, and this entry was wrong: it was
  written before the dimension was settled and never updated once the schema landed. The
  index was created in migration 0000 (`chunks_embedding_idx`, `vector_cosine_ops`) at the
  same time as the table, because building it on an empty table is free — adding it later
  would mean a migration that rebuilds over every row.
- **Upgrade to TypeScript 7 / ESLint 10.** Blocked upstream — see
  `docs/decisions/001-pin-typescript-5-and-eslint-9.md`.

## Open decisions

- ~~**Generation provider — deliberately deferred to Milestone 2.**~~ Decided in Milestone 2:
  `gemini-3.5-flash-lite`, pinned, with `lib/ai/provider.ts` still the only file that names a
  provider. See `docs/decisions/012-generation-model.md`.

  The A/B this entry asked for has **not** happened and is now genuinely possible — it needed
  a working chat surface and real documents, neither of which existed when the entry was
  written. Worth doing once Milestone 2 ships: compare a larger Gemini model first (one
  identifier), then Groq or an OpenRouter free variant. The current choice is a starting
  point, not a verdict.

- **The relevance floor short-circuits the `list_documents` tool.** The chat route refuses
  before calling the model when no passage clears `MAX_DISTANCE`. That is the right default —
  it is what makes "I don't know" structural rather than a prompt instruction — but it means a
  question _about_ the workspace rather than its contents ("what have I uploaded?") is refused
  instead of answered by the tool, because no passage will ever match it. The tool currently
  only fires on questions where retrieval already succeeded.

  Fixing it properly needs intent classification (is this a question about content, or about
  the collection?), which is a bigger change than it looks and was not in Milestone 2's scope.
  The cheap alternative — always calling the model and letting it decide — gives up the
  guarantee that an unanswerable question cannot produce a fabricated citation, which is the
  milestone's headline claim. Not obviously worth trading. Revisit once there is real usage
  showing whether anyone actually asks this.

- **Per-session cap for guest mode.** Not a quota-exhaustion worry — free-tier Flash-Lite
  allows roughly 1,000–1,500 requests/day, and a guest session of ~5 questions means
  200–300 sessions/day, far beyond what a portfolio demo sees organically. The real
  exposure is a bot or a single abusive visitor. So the guard is a per-session/IP cap plus
  a graceful "demo limit reached" state — _not_ keeping the demo switched off, which would
  break the cold-link scenario Milestone 5 depends on — a stranger opening the URL with no
  explanation. Folds
  into Milestone 3 rate limiting; may want a cheap guard as soon as guest mode is live.

- **Verify the EEA data-protection exception against the real account.** Google grants
  paid-service data terms — no training on prompts or uploaded files — to customers in the
  EEA, Switzerland and the UK even on unpaid quota. That removes the training-disclosure
  obligation previously recorded here, but it follows the account's billing region rather
  than the plan. Confirm it in the Google account before stating anything to a user, and
  re-check if billing ever moves. See
  `docs/decisions/002-embedding-model-and-dimension.md` and
  `docs/decisions/007-commercial-optionality.md`.

## Deployment

- **Nothing ties a schema change to a production migration.** A migration added during
  development is applied locally and then shipped, and production only finds out when a
  query touches the missing column. This has already caused one production outage: migration
  0001 added `content_text` and `page_spans`, was applied to the dev branch only, and uploads
  returned a bodyless 500 while the documents list kept working — because the list selects
  columns explicitly and the insert did not.

  Two candidate fixes, neither obviously right:

  - **Migrate in the deploy pipeline.** Reliable, but a migration running as a side effect of
    a build is hard to reason about when it half-fails, and it would run on every preview
    deployment too.
  - **Fail fast on schema drift.** A startup check comparing the migration journal against
    the database, so a mismatch is an immediate, explicit error rather than a 500 on the
    first request that happens to touch a new column.

  The second is more honest about what went wrong. Worth deciding before Milestone 2 adds
  more migrations.

## Only if it earns money

Deliberately not built yet — see `docs/decisions/007-commercial-optionality.md` for why
each of these is reversible and therefore safe to defer.

- **Vercel Pro ($20/mo).** Hobby is restricted to non-commercial personal use, so the first
  paying customer makes the current plan a terms violation. A billing page, not a migration.
- **Privacy policy, terms of service, sub-processor list, DPA.** Required before taking
  money from EU customers; easier to write once the product's real data flows exist.
- **A paid or DPA-covered model provider.** The current Gemini free tier is for development
  and the seeded demo only. Before real users upload their own documents, the provider needs
  either a paid tier or a data processing agreement — processing someone else's personal
  data on a free consumer tier is not a position to defend, independently of whether that
  tier trains on the content.
- ~~**Cross-tenant leakage test in CI.**~~ Done in Milestone 1 — seven tests in
  `lib/documents/queries.integration.test.ts` prove another workspace's documents cannot be
  listed, found, updated, deleted, or have chunks read or written, and they run in CI
  against a real database.

## Ideas (unscheduled)

- **UUIDv7 primary keys instead of UUIDv4.** Postgres 18 ships a native `uuidv7()`.
  The schema currently uses Drizzle's `defaultRandom()`, which is `gen_random_uuid()`
  (v4, fully random), so every insert lands at a random point in the primary key's
  B-tree. v7 is time-ordered and gives sequential inserts — meaningful for `chunks`,
  where one PDF bulk-inserts several hundred rows. Deferred because it pins the schema
  to Postgres 18 specifically, and the gain is unmeasured at portfolio data volumes.
  Worth benchmarking during Milestone 1 ingestion work rather than assuming.

- Bundle-size budget enforced in CI for the chat route.
- Lighthouse CI as a PR gate rather than a manual measurement.

## Measured, for the bundle budget

- **Workspace page initial JS: 694 KB uncompressed** (11 chunks), measured against the
  production build by reading the script tags the page actually serves. The chat UI brought
  `streamdown` in for streaming-safe markdown, which pulls `mermaid` and a syntax
  highlighter transitively — but both sit behind `React.lazy`, and **neither appears in any
  chunk the page loads**, confirmed by grepping the served chunks. The 428 KB chunk holding
  them is only fetched if an answer contains a diagram or a code block, which document
  answers essentially never do.

  Recorded now so the Milestone 3 bundle budget has a baseline to compare against rather
  than a target invented after the fact.

- **A PDF as the demo document, for page-numbered citations.** The seeded fixture is
  Markdown, which has no pages — so demo citations show a filename but never "page 7", and
  the page number is one of the more convincing details of the citation UI. Page numbers are
  covered by tests (`chunking`, `normalize`, `pipeline`, `ingest` and `retrieve` suites all
  exercise them), so nothing is unverified; this is demo polish, not a gap.

  Blocked on authoring a PDF we can actually commit. A third-party sample PDF is not
  publishable on a public repo with no license file, and the fixture has to be committed or
  CI and fresh clones have nothing to seed. Folds naturally into Milestone 4's demo-content
  curation.

## Observed in production, for Milestone 3

- **The relevance floor is too permissive for real embeddings.** `MAX_DISTANCE = 0.6` was set
  as a guess (ADR 011 and `retrieval-config.ts` both say so) and could not be tuned earlier:
  there was no production traffic, and the fake embedder's distances carry no semantic meaning.
  First real evidence: on the deployed app, "how are you?" and "test" both cleared the floor.
  The model declined on its own, so nothing was fabricated — but the floor exists precisely so
  the model is never called for those, and every question that slips past costs a Gemini
  request, a round trip of latency, and control of the refusal wording. More importantly it
  weakens the guarantee's character: "structurally cannot fabricate" becomes "the model chose
  not to", which is the thing ADR 011 argued against relying on.

  Tuning needs a distribution, not anecdotes. That can be collected without breaking the
  logging rule — record the **top distance** for each query and whether it cleared, never the
  question text. The floor compares numbers; nothing about calibrating it requires storing what
  anyone asked. A few hundred samples would show where relevant and irrelevant questions
  actually separate, which is the before/after ADR 008 and ADR 011 both ask for.

- **Refusals from the model read worse than our own.** When retrieval returns weak passages and
  the model declines, it produces things like "The provided passages do not contain information
  to answer how I am" — stilted next to `NO_RELEVANT_PASSAGES_REPLY`. Worth a prompt line about
  _how_ to decline, in the same pass as the floor tuning. Fixing the floor reduces how often
  this path is reached, but does not remove it.

- **Questions about the product get refused, and they are the first ones people ask.** Observed
  across two fresh accounts: "how can I upload files?", "can you help me?", "okay bye" all
  produce "the provided passages do not contain information...". Each is a reasonable question
  with a real answer that simply is not in anyone's documents.

  Grounding is working exactly as designed here, so this is a product gap rather than a bug,
  and the fix is **not** to loosen the grounding rule — that is the guarantee. Options worth
  weighing: a refusal that points at the interface ("I only answer from your documents — the
  upload area is above"), or a small set of product answers the assistant may give without
  citing. The second is a bigger commitment than it looks, because it introduces a second
  source of truth the model can answer from, and the whole design rests on there being one.

  Note that "who are you?" already gets a self-description drawn from the system prompt, with
  no citation attached. That is acceptable and should stay: a question about the assistant,
  answered by the assistant, claiming no source. Belongs with Milestone 4's onboarding work.

- **The accessibility pass needs eyes, not only axe.** A citation chip once rendered in the
  same colour as the bubble behind it — functional, correctly labelled, and invisible. Every
  component test passed, and axe would have passed it too: contrast rules compare text against
  its background, and that pair is a designed one. What failed was affordance, which no
  automated check measures.

  So "axe clean" as a Milestone 3 exit criterion should be read as a floor. The pass also needs
  a human looking at each interactive surface and asking whether it _reads_ as interactive —
  chips, the composer, the source panel's close control, the retry button in the error state.
