# Backlog

Parking lot for anything that isn't in the current milestone. No scope creep: ideas land
here, not in the current branch.

## Deferred from Milestone 0

- **Email magic-link sign-in.** Planned alongside GitHub OAuth.
  Deferred from Slice 3 because it needs an email-sending account (Resend or similar) that
  does not exist yet, and GitHub OAuth plus guest mode already satisfies the milestone's
  exit criteria. The Auth.js provider is a few lines once a sender is configured; the
  `verification_tokens` table it needs is already migrated.

  ↳ **Half-unblocked, 4 August 2026.** `citeseek.app` is bought, so the verified sending domain
  Resend requires is now available. The sender account itself is still the missing piece, and
  this stays parked until a contact form or magic-link actually needs one — a second auth path
  nobody has asked for is not worth the subprocessor entry on the privacy page.

- **Google sign-in, if this is ever commercialized.** GitHub OAuth is a _developer_ credential:
  the right signal for a portfolio project read by engineers, the wrong one for a customer who has
  never made a GitHub account. Google is the highest-coverage consumer provider and costs no new
  subprocessor — it is already named on the privacy page for Gemini.

  **The provider config is not the work; account linking is.** Auth.js with a database adapter
  refuses by default when someone signs in with Google using an email already registered through
  GitHub — they get `OAuthAccountNotLinked`, which reads to a user as "your account is broken".
  Decide deliberately between linking automatically on a verified email (convenient, and only safe
  because both providers verify) and keeping the identities separate with an explanation. Whichever
  is chosen, the privacy page's "GitHub — only if you sign in with it" line has to change with it.

  Not needed for any milestone as scoped: the exit criterion is a stranger reaching a cited answer
  in two minutes, which they do as a guest with no sign-in at all.

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

- **Keyword search alongside vector search (hybrid retrieval).** Planned for Milestone 2 as
  optional and not built. Embeddings match meaning, which is the point, but they are weakest on
  exactly the terms a reader is most likely to type verbatim: a product code, an error string, a
  person's name, an acronym that appears twice in a corpus. A lexical index (Postgres full-text
  search is already available) catches those, and the two are combined by rank rather than by
  score, since a cosine distance and a text-search rank are not on the same scale.

  Worth doing after the relevance floor is tuned, not before — the floor decides what counts as
  a match at all, and changing both at once would make neither measurable.

  ↳ **Built, measured, not shipped — ADR 021.** The harness is how it had to prove itself and it
  did not: lexical alone scores 0.53 MRR against the vector path's 0.82, and every fusion weight
  makes the blend _worse_ than vector alone. `gemini-embedding-001` already handles the
  term-heavy questions this was meant to rescue. The index and the two modules stay, unused by
  the product, so the question is one command to re-ask when the corpus is real.

  The floor gap ADR 020 opened is therefore still open. Hybrid was the candidate; what is left is
  a reranker over the top k, or accepting the floor as a filter and saying so — which the README
  now does.

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

- ~~**Per-session cap for guest mode.**~~ Decided in Milestone 3 — see
  `docs/decisions/014-usage-limiting.md`. One correction to the reasoning below: a _per-session_
  cap was never viable, because `/demo` mints a fresh session cookie on every visit, so the
  session is self-assigned. Guest limits count the client address instead. The original entry
  follows for the record.

  Not a quota-exhaustion worry — free-tier Flash-Lite
  allows roughly 1,000–1,500 requests/day, and a guest session of ~5 questions means
  200–300 sessions/day, far beyond what a portfolio demo sees organically. The real
  exposure is a bot or a single abusive visitor. So the guard is a per-session/IP cap plus
  a graceful "demo limit reached" state — _not_ keeping the demo switched off, which would
  break the cold-link scenario Milestone 5 depends on — a stranger opening the URL with no
  explanation. Folds
  into Milestone 3 rate limiting; may want a cheap guard as soon as guest mode is live.

- ~~**Verify the EEA data-protection exception against the real account.**~~ **Overtaken by
  ADR 025.** The account is EEA-billed, so the exception plausibly applied — but the paid tier was
  attached anyway rather than relying on it. A guarantee that follows a billing region is one
  address change away from lapsing, and a privacy page should not rest on something that can move
  without anyone noticing. Re-read this if billing ever leaves the EEA.

## Known defects

- ~~**`pnpm db:seed` cannot tell which database it reached.**~~ **Fixed.** `assertHostWasChosen`
  refuses any remote host that `SEED_HOST` has not named, and a mismatch reports both the host
  asked for and the one resolved. Read from the shell rather than `.env.local`, on the same
  provenance argument as the embedder guard beside it: the file that supplied the wrong answer
  cannot also be the one that confirms it.

  Worth keeping for the shape of it. The existing guard was the right _idea_ aimed at the wrong
  _subject_ — it checked which embedder and never which database — which is how the third
  occurrence walked past it (`docs/code-review-notes.md`).

- **A link clicked during hydration commits the URL and never renders the destination.**

  Diagnosed rather than guessed. Under load — `--repeat-each=40 --workers=4` against one Next
  process, on the wordmark's `/sign-in` → `/` transition — it fails about **3 times in 120
  runs**. Waiting for React to own the anchor first: **0 in 80**.

  What the failure looks like is what identifies it. The accessibility snapshot has the header
  and the footer, **no `<main>` at all** — so neither the page nor `(marketing)/loading.tsx` is
  on screen — and Next's route announcer is present but **empty**, which is its state until a
  navigation completes and announces a title. The URL has already changed. So the router began a
  transition, committed the URL, and never finished it.

  **Timeouts are not the answer**, which is the part worth keeping: raising the assertion to 15s
  and then to 30s changed the failure rate not at all. It waits the full thirty seconds. Whatever
  the router is waiting for never arrives rather than arriving late.

  The window is between paint and hydration, and it is the same window in which a click on the
  theme control is dropped — different symptom, one cause. A real reader can hit it, and it is
  the likely explanation for "a route change sometimes takes too long" locally, where a remote
  database in Frankfurt (measured: 34 ms per query, ~100 ms for a workspace render) lengthens
  every server render and with it the time before hydration finishes.

  ↳ **One of those queries is the session lookup, and it runs on every request.** Auth.js is on
  database sessions here (ADR 005), so a route that never reads the user still pays a round trip
  before it can render. That is a documented trade rather than an oversight — but it is a
  contributor to this window, and the two were tracked as unrelated until an outside review put
  them together. Anything that shortens the window has to count it.

  **Not ours to fix directly.** It reproduces on `main`, so it predates the recent header work,
  and the project is already on Next 16.2.12 — the latest release. What shortens the window is a
  smaller client bundle, which the README's own numbers show is where the workspace route's
  remaining weight is (124 KB of unused AI SDK and Zod).

  The E2E suite waits for hydration before clicking (`e2e/hydration.ts`) because it is testing
  the wordmark, not the handover. That is a workaround, and the underlying defect is this entry.
  Worth filing upstream with the reproduction above.

## Deployment

- ~~**Nothing ties a schema change to a production migration.**~~ Closed in Milestone 3 — see
  `docs/decisions/015-schema-drift.md`. Neither of the two options recorded below was taken:
  migrating in the pipeline would let a _preview_ build mutate whichever database Preview points
  at, and failing at startup would take the whole site down rather than one route. A build-time
  **check** fails the deploy instead, leaving the running version serving. The original entry
  follows for the record.

  A migration added during
  development is applied locally and then shipped, and production only finds out when a
  query touches the missing column. This has already caused one production outage: migration
  0001 added `content_text` and `page_spans`, was applied to the dev branch only, and uploads
  returned a 500 with no body while the documents list kept working — because the list selects
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
  paying customer makes the current plan a terms of service violation. A billing page, not a migration.
- **Privacy policy, terms of service, sub-processor list, DPA.** Required before taking
  money from EU customers; easier to write once the product's real data flows exist.

  ↳ **Resolved in Milestone 4, against this entry.** The privacy page and terms shipped, and the
  filing above was wrong: the trigger is not revenue but **processing**, and the app accepts
  third-party uploads today. A DPA and a formal sub-processor list still belong here, because
  those are commitments a company makes; saying accurately what happens to a file is not.

- ~~**A paid or DPA-covered model provider.**~~ **Done, 6 August 2026 — ADR 025.** The original
  entry follows. The current Gemini free tier is for development
  and the seeded demo only. Before real users upload their own documents, the provider needs
  either a paid tier or a data processing agreement — processing someone else's personal
  data on a free consumer tier is not a position to defend, independently of whether that
  tier trains on the content.
- ~~**Cross-tenant leakage test in CI.**~~ Done in Milestone 1 — seven tests in
  `lib/documents/queries.integration.test.ts` prove another workspace's documents cannot be
  listed, found, updated, deleted, or have chunks read or written, and they run in CI
  against a real database.

## Ideas (unscheduled)

- ~~**A page-shell component for the gutter.**~~ **Done.** `pageShell(width, className)` in
  `components/ui/page-shell.ts` owns `mx-auto w-full px-3 py-12 sm:px-6` and the three widths;
  fourteen call sites pass only what differs. `py-12` is the default because eight of them want
  it, and `cn` lets the rest override it.

  **Not the component this entry asked for**, for the reason the entry missed: the gutter sits on
  four different elements — `main`, `section`, `footer`, `div`. A component would have needed an
  `as` prop, burying a semantic choice behind a string. A function returning classes keeps the
  element visible where it can be audited, and still removes the whole repetition rather than the
  quarter a static utility class would have.

  Two corrections to the entry: it was 14 files, not 18, and `error.tsx`/`not-found.tsx` never
  carried the gutter at all.

  **The first pass found only twelve**, and review caught the two it missed — the landing hero and
  the header nav, both written `mx-auto flex w-full max-w-…` with a class in the middle. The grep
  that "verified" the extraction searched for the literal `mx-auto w-full max-w-`, so it could not
  match them: the check was incapable of finding what it was claiming. Worse, one of the two sat
  thirty lines from a block the same commit had converted.

- **UUIDv7 primary keys instead of UUIDv4.** Postgres 18 ships a native `uuidv7()`.
  The schema currently uses Drizzle's `defaultRandom()`, which is `gen_random_uuid()`
  (v4, fully random), so every insert lands at a random point in the primary key's
  B-tree. v7 is time-ordered and gives sequential inserts — meaningful for `chunks`,
  where one PDF bulk-inserts several hundred rows. Deferred because it pins the schema
  to Postgres 18 specifically, and the gain is unmeasured at portfolio data volumes.
  Worth benchmarking during Milestone 1 ingestion work rather than assuming.

- Bundle-size budget enforced in CI for the chat route.
- Lighthouse CI as a PR gate rather than a manual measurement.

- ~~**One rule for confirming a destructive action.**~~ **Done**, 21 August 2026 —
  [ADR 042](decisions/042-one-rule-for-destroying-something.md). The rule is written down, the two
  false claims are deleted, and deleting an exchange joined the middle tier rather than earning a
  lighter one. **Undo was designed and rejected**: restoring after the fact needs an endpoint
  taking message content from the client, which is ADR 035's failure self-inflicted, and deferring
  the delete holds the cap shut at the moment a reader is deleting to make room. The frequency
  premise was also weak — 40 saved messages is 20 exchanges, not a daily habit. Revisit if the
  server ever holds deleted rows itself, which would make restore safe. The original entry follows.

  There are three now and they do not agree:
  deleting an account requires typing a word, deleting a conversation opens a dialog naming it,
  deleting a document happens on the first click. The graduation is defensible — account, then
  conversation, then a document that can be uploaded again — but it was arrived at one report at
  a time rather than decided. Worth settling as a single rule, with undo considered as the
  alternative to confirmation: a delete that can be taken back for a few seconds interrupts
  nobody and protects the same mistake.

  ↳ **"Deleting a document happens on the first click" is false**, found 21 August 2026 while
  sizing this for Milestone 8. `components/documents/document-list.tsx` opens an `AlertDialog`
  naming the file and exactly what goes with it — "the document, its extracted text and every
  passage indexed from it". A comment in `components/chat/conversation-list.tsx` repeats the same
  false claim and points here, so the two have been agreeing with each other rather than with the
  code.

  So this is **not three rules that disagree**. It is one rule already implemented twice — a dialog
  naming the object and its cost — plus one deliberate escalation for the account, and two written
  claims that outlived the code. The work is writing the rule down and deleting the two statements,
  not a retrofit.

  What is still genuinely open is the tier below: a per-turn delete is frequent and small, and the
  conversation dialog's own comment already makes the argument one level up — "a typed confirmation
  on every row trains the reader to type through it". A dialog on every turn trains the reader to
  click through it. That is the case for undo, and it is Milestone 8's to settle.

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

- **Dark mode: the palette exists and nothing can reach it.** `app/globals.css` carries a
  complete `.dark` token block from the shadcn scaffold, and the Tailwind variant is
  **class-based** (`@custom-variant dark (&:is(.dark *))`). No provider, toggle or script ever
  adds that class, so the palette is dead code — and because the variant is class-based rather
  than media-query based, a visitor whose system is set to dark currently gets the light app.

  Deferred to **Milestone 4**, not to "someday", for three reasons that are all about cost
  elsewhere:

  - **A second theme doubles the accessibility surface.** Every axe scan has to run twice, and
    the hand-written checks — the citation chip against its bubble especially — have to hold in
    both. That contrast pair is exactly what shipped broken once.
  - **It must not land before the performance numbers.** Class-based theming under SSR needs a
    blocking inline script before first paint to avoid a flash, which is precisely the kind of
    thing Lighthouse measures. Introducing it mid-measurement means the numbers describe a
    moving target.
  - **The toggle needs a home.** Milestone 4 already adds an account page and a navigation menu;
    a theme control belongs in one of them rather than being bolted onto the header first and
    moved later.

- **Local E2E runs accumulate usage against one caller, and can exhaust the guest daily cap.**
  Every local guest hashes to the `"local"` address sentinel, so ~20 runs of the suite reach the
  40-request guest daily cap on the development database. `USAGE_LIMITS=off` in
  `playwright.config.ts` prevents enforcement — but only for a server Playwright _starts_.
  `reuseExistingServer` is true locally, so a stale `pnpm start` left on port 3000 by anything
  else is reused **with the flag absent**, and the whole suite then fails on
  `capacity_reached` with no obvious connection to the cause.

  Verified rather than guessed: with the flag set the chat route answers 200 against the same
  40 rows; without it, 429. Instrumenting the webServer command confirmed Playwright does pass
  the variable to servers it spawns.

  Two candidate fixes, neither done: give each run a distinct
  `x-vercel-forwarded-for` via Playwright's `use.extraHTTPHeaders`, so runs stop sharing a
  bucket and the real limits stay exercised; or have the suite fail loudly when the server it
  attached to lacks the flag, rather than failing 6 specs for an unrelated-looking reason. The
  second is the more general fix — a harness that silently attaches to a differently-configured
  server is a category of confusion, not one bug.

- **`/w` and `/demo` can give no navigation feedback at all.** Both are redirect-only route
  handlers, so a click leaves the browser sitting on the old page until the server answers.
  Neither mechanism reaches them: `loading.tsx` needs a React tree that does not exist for a
  route handler, and `useLinkStatus` does not report pending for a navigation that is not a
  client-side transition — measured, not assumed. Every _page_ route now has a loading boundary,
  so this is the only remaining gap.

  Left as is on the evidence: `/demo` measures **134 ms** in production (README, region
  colocation), which is below the threshold where an indicator helps — at that speed a loader
  flashes, which is worse than nothing. Revisit if cold starts make it perceptible.

  The tempting fix is converting them to pages so they can have boundaries, and it has a
  specific hazard: Next prefetches `<Link>` targets, and `/w` **creates a workspace**. A page
  that writes could have its write triggered by a hover. The route handler is the right home for
  it, as its own comment says.

- **Nothing consumes the signal that usage recording failed.** `recordUsage` returns
  `{ recorded: boolean }` and every caller discards it. That is not theoretical: production ran
  for two deploys inserting into a table that did not exist, recorded nothing, and reported
  nothing — the caps would have been silently inert had they already been enforced. The build-time
  migration check (`docs/decisions/015-schema-drift.md`) closes the cause that actually happened;
  it does not close the class. A connection limit, a permissions change, or a full disk produce
  the identical silence.

  The obvious fix does not work here. A module-level failure counter is **per serverless
  instance** — instances are created and discarded per request, so a count in memory is neither
  shared nor durable, and would read as zero almost always. Anything real has to live where the
  data does: a row, or a platform-level alert on the insert failing. Worth deciding alongside
  Milestone 4's usage dashboard, which reads the same table and would surface a stall naturally —
  a dashboard flat at zero is a signal, if someone is looking at it.

  Not fail-closed: refusing chat because an accounting row did not land would trade a metering
  gap for an outage, which is the wrong direction for a mechanism that exists to keep the demo
  answering.

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
  same color as the bubble behind it — functional, correctly labeled, and invisible. Every
  component test passed, and axe would have passed it too: contrast rules compare text against
  its background, and that pair is a designed one. What failed was affordance, which no
  automated check measures.

  So "axe clean" as a Milestone 3 exit criterion should be read as a floor. The pass also needs
  a human looking at each interactive surface and asking whether it _reads_ as interactive —
  chips, the composer, the source panel's close control, the retry button in the error state.

## Deferred to Milestone 4 (product surface)

- ~~**An account page.**~~ Done in Milestone 4. `/account` carries the user's details, how they
  sign in, sign out, and account deletion — which moved off the header, where an irreversible
  action sat one stray click from a wordmark on every route with no room to say what it
  destroys.

- ~~**A navigation menu.**~~ Done in Milestone 4, alongside the account page — which is what
  made the third destination exist. The back link went with the change rather than surviving
  beside real navigation: it pointed at the same place the wordmark does, a redundancy its own
  comment already noted on the landing page.

- **Workspace membership and roles (owner / member / viewer).** Planned for Milestone 4 and
  **cut** — see `docs/decisions/016-workspace-membership-deferred.md`. Short version: the claim
  it would buy is already true and already proven by seven cross-tenant integration tests, and a
  role column whose only production value is `owner` adds an authorization branch no user can
  reach. Invitations would need email, which is itself deferred for want of a sender. The ADR
  records the seam so the shape is not re-derived: `findWorkspaceById` returns the caller's
  membership alongside the workspace, and `accessToWorkspace` stays pure and synchronous.

- **Multiple workspaces per user, and workspace management.** Planned for Milestone 4 and **cut**
  — same ADR. Needs a switcher, a create flow and a delete flow, and multiplies the surface of
  history, documents and the usage dashboard, each of which would have to answer "which
  workspace?". Additive whenever it is wanted; nothing in the schema rules it out.

## Branding

- **There is no mark, only a wordmark, and that is the current position rather than a gap.**
  The header sets "CiteSeek" as text in Audiowide. Two placeholder images preceded it — a raster
  "C" composed against the text "iteSeek", then an SVG that read "LOGO" — and both were worse
  than nothing: the first was a half-real lockup nobody kept noticing was provisional, and the
  second removed the product's own name from its own header.

  Text is also the cheaper position to hold. It follows the theme with no second asset and no
  `invert`, stays crisp at any density, and is selectable and searchable. A real mark should be
  added _beside_ it rather than replacing it.

- ~~**The favicons are still the mark the header no longer uses.**~~ **Done, 17 August 2026.**
  Both are now generated from `scripts/brand/mark.svg` — a geometric C in `--primary`, drawn in
  the repository rather than commissioned, so there is no stock-art question on a public
  all-rights-reserved repo. A unit test pins the mark's colors to the palette, since the PNGs
  are committed and nothing rebuilds them when a token moves.

  Two things the entry above got right and one it did not. Right: the old icons were a raster
  lockup on an opaque plate, and the tab disagreed with the page. Wrong: "not urgent, because
  both beat the create-next-app default" understated it — at 16px the magnifier, document and
  quote marks resolved to an illegible blob, which is the size a favicon is actually seen at.
  **The mark still does not appear in the header**, so the wordmark-only position below is
  unchanged.

  Worth recording about the brief that produced the original: the commissioned research report frames
  CiteSeek as a tool for **academic researchers** and benchmarks it against Google Scholar,
  Zotero and PubMed. Nothing in this project says that — the README says "AI document
  assistant", the demo fixture is a company handbook, and the positioning is EU-hosted and
  GDPR-first. The persona appears to be inferred from the word "citations". Re-brief before
  commissioning anything.

- **A logo asset, briefed against what the wordmark already gets for free.** Ask for
  transparency, vector, and a single-color variant explicitly. The reason is what both
  placeholders cost: the raster had no alpha at all, forcing a white plate in both palettes, and
  the SVG that replaced it only worked in dark because every fill was the same `#1A1A1A` — a
  mark carrying a brand color needs two assets or inline SVG on `currentColor`. Text needs
  none of that, so a mark has to earn its place beside it.

- **Trim the code comments across the codebase.** The convention going forward is that a comment
  explains the non-obvious — a coupling, a measured number, a defect prevented, a rejected
  alternative — and that everything else is noise. Much of the existing code predates that and
  carries paragraphs on things any developer knows.

  Worth doing as **one mechanical pass in its own commit**, not folded into feature work: mixed
  into a diff that also changes behavior, a reviewer cannot tell the two apart, which is the
  opposite of what a review-heavy project wants. The risk is deleting the sentence that was
  actually load-bearing, so the rule when cutting is to keep anything naming a number, a file, a
  bug, or **what a thing is not** — that last one is the easiest to lose and the most expensive.
  The paragraph in `proxy.ts` saying the proxy is _not_ the authorization boundary names the exact
  misconception behind middleware-bypass CVEs, and none of the other three would have spared it.

- **A `/contact` page, once a domain is bought.** The privacy page has to name somewhere an
  erasure request can go, and that currently points at the GitHub repository. It works, and it is
  the wrong anchor: a repo that goes private takes the policy's only contact route with it —
  the same failure as the sentence that once promised a link nobody had built.

  ~~**Waiting on a domain deliberately, because one purchase unblocks three parked items**~~ —
  **`citeseek.app` was bought on 4 August 2026**, so all three are unblocked: an address on a
  domain you control rather than a personal inbox scraped off a public page, the verified
  sending domain Resend needs before a contact form can send anything, and the same sender that
  has magic-link sign-in parked above.

  The old host redirects rather than disappearing: `cite-seek.vercel.app` answers **307** to the
  same path on `citeseek.app`. 307/308 rather than 302/301 because the older pair lets a client
  rewrite the method, and a permanent redirect is cached hard enough that a mistake outlives the
  fix — which is why it stayed temporary until a real sign-in confirmed the move. It did, so the
  remaining step is promoting it to **308**.

  **A domain move breaks anything that registered the old origin with a third party**, which no
  redirect can repair: GitHub's OAuth App has one callback URL, it does not follow a redirect,
  and it rejects the mismatch _after_ the user has logged in — so the authorize step looks
  healthy and sign-in fails at the last hop. Auth.js needed nothing: it builds `redirect_uri`
  from the request host, so it followed the domain on its own.

  Ship the page with a plain address first and add the form after — a form that cannot send is
  worse than no form, because it looks like it works. When the form lands, the privacy page needs
  a paragraph for it: a contact form is a new personal-data flow, and this policy is specific
  about what it stores, for how long, and who reads it.

## Watching someone use it

**One cold reader, one finding, shipped.** A senior frontend engineer was given the URL and
watched, unprompted. She found the demo workspace immediately — the path in is fine. Then she
clicked the document row, and the filename, and the box around both, trying to open
`northwind-remote-work-handbook.pdf`. Nothing happened, because nothing was a control.

What she was after is the interesting part: she was not trying to read the handbook, she was
trying to find out **what it was about, so she would know what to ask it**. An empty composer
above a document whose contents you cannot see is a question with no visible answer space.

And there was nothing else to work from. The empty chat state said "Ask a question about your
documents" and stopped — no examples there or anywhere else, the refusal (ADR 017) listing
filenames rather than questions. In a shared demo the possessive was wrong too: they are not her
documents, and she had no way to learn what was in them. Clicking the document was the only move
the screen offered.

Shipped as: the filename opens the same side panel citations open, with the full extracted text
and no highlight. Not a new tab — the original file no longer exists to serve (ADR 009), so a
new tab could only render the same extracted text one navigation further away.

**From the same session**, three since closed and one still open:

- ~~**Example questions in the empty chat state.**~~ **Done — ADR 022.** There were none anywhere
  in the app, so this was new content rather than copy moved from somewhere. Three hand-authored
  questions on the seeded demo only, each chosen by embedding it against the fixture and checking
  the rank of the passage that answers it. Generated-per-document for uploaded workspaces stays
  parked below.
- ~~The empty state says "your documents" on a shared read-only demo.~~ **Done.** It said so in
  four places, not one — the empty state, the composer's label, its placeholder, and the
  screen-reader status. The demo now says "the handbook".
- ~~The row is clickable but does not _look_ clickable until hover.~~ **Done.** Worse than
  recorded: a touch screen has no hover at all, so on a phone the filename rendered identically
  to plain text. A panel icon now sits beside it on every device. A hover-conditional underline
  was built first and rejected — it left the affordance depending on a media query.
- Nothing tells you a document is readable _before_ you have a reason to want it. A one-line
  summary per document is the obvious answer and is a generation cost per upload, so it is a
  decision rather than a task. The demo's starter questions cover the reader this came from;
  they do nothing for a workspace someone uploads to, which is the case this would serve.

## Navigation

- ~~**Duplicate RSC prefetches on arrival.**~~ **Not a defect — measured wrong.** Arriving at the
  workspace fires 15 `?_rsc=` requests, and every route appears twice. The original entry read that
  as waste. It is not: Next 16 prefetches each route in two parts, one carrying
  `Next-Router-Segment-Prefetch: /_tree` for the route tree and one carrying the segment payload
  with a `Next-Router-State-Tree` header. Two requests per route is the design.

  Two things worth keeping from the investigation. The hypothesis that links were duplicated in the
  DOM (desktop nav plus mobile menu) was **wrong** — only `/sign-in` has two anchors, from the
  header button and the read-only card. And "eight requests" in the first note was undercounted
  because it was read off a partial trace rather than a full capture.

## Hosting, if the terms or the price stop fitting

- **Vercel Hobby is non-commercial only.** The same shape as the Gemini free-tier rule: a plan whose
  terms forbid the thing the roadmap plans for. A portfolio demo with no revenue is exactly what
  Hobby is for, so nothing is wrong today — but the first paying customer makes it a violation,
  and Pro is around $20/month. Worth knowing before an invoice makes the decision.

- **A single EU VPS would replace both Vercel and Neon**, and would strengthen the positioning
  rather than compromise it. Hetzner is a German company in German datacenters at roughly €5/month
  for app and database together — against ~$20 for Vercel Pro plus whatever Neon costs above free.
  The repo already runs Postgres with pgvector under `docker compose` locally, so the database half
  is a configuration change rather than a rewrite, and "EU-owned and EU-hosted" is a stronger claim
  than "EU region on a US provider".

  **The cost is not the hosting, it is what Vercel does for free.** Preview deploys per pull
  request, which this workflow reviews on; automatic rollback; the CDN; zero-config support for
  streaming and React Server Components; and `vercel.json`'s `db:check && build` gate, which is what
  currently stops a deploy landing against an unmigrated database. Each of those has to be rebuilt
  or given up, and giving up preview deploys is the one that would be felt daily.

  Middle options worth pricing before jumping: Railway, Render or Fly.io keep push-to-deploy and EU
  regions at roughly $5/month, and Supabase has a free tier with pgvector. Cheaper than Vercel Pro,
  more managed than a bare VPS.

  **Not urgent, and the trigger is a date rather than a number**: the first revenue, or the first
  month Hobby's limits actually bite. Until then Hobby is legitimate and free.

- **Neon's free tier suspends compute after inactivity**, which is a candidate explanation for
  "route changes take too long sometimes" — a demo with sporadic traffic means most visitors are
  the one who wakes the database. Measured warm, a `/demo` navigation is ~400ms end to end and the
  database round trip is 34ms; neither was measured cold. Worth doing before assuming the frontend
  is at fault: leave the site alone for an hour, then time the first load. ADR 024's progress bar is
  right either way, but it may be covering Postgres waking rather than Next being slow.

## Abuse: what is covered, and what is accepted

Reviewed 6 August 2026 rather than assumed. All three expensive routes enforce limits — chat,
upload, and the document **retry** endpoint, which is the one most easily forgotten because it
re-embeds a document that was already paid for once.

**Cost is bounded three independent ways**, and any one of them would do: the global daily cap
(800 requests, of which guests may take 600), the prepaid credit balance with auto-reload off, and
the spend cap on the Google account. An attacker cannot run up a bill.

**The 800/600 split is already the answer to half of this.** A guest flood can consume at most 600,
so 200 stay reserved for signed-in users and a bot cannot take down the author's own workspace
mid-interview. ADR 014 built that on purpose, and it holds.

### What is not covered

- **A day of demo availability.** Burning the 600 guest requests is cheap and denies the demo to
  real visitors until the window resets. Signed-in access survives; the thing a stranger clicks
  does not. This is the real remaining exposure, and it is **accepted** rather than solved.
- **Rotating IPs defeat the per-address limits outright.** Guests are keyed on
  `HMAC-SHA256(ip, AUTH_SECRET)` because `/demo` mints a fresh cookie per visit, so the address is
  the only stable handle there is. The global cap is the only backstop, which is the availability
  problem above restated.
- **A refused request is cheaper than an answered one, not free.** It still costs a Vercel function
  invocation, an auth check and a Postgres count query — all of which happen _before_ the limiter
  decides anything. A sustained flood therefore burns Hobby's invocation quota and wakes Neon
  repeatedly, neither of which the limiter can see.

### The one thing worth doing

**Vercel's Attack Challenge Mode**, available on Hobby, is a single toggle that puts a challenge in
front of traffic _before_ functions run — the one layer with nothing at it today. Free, and the
highest leverage available.

Nothing below that. A portfolio demo with no attackers does not need a WAF ruleset, and building
one would be diligence that reads as over-engineering. The defensible position is the one already
true: cost bounded three ways, guests unable to starve signed-in users, and a day of demo
availability knowingly at risk from an attacker with rotating addresses.

## Measured, 6 August 2026

- ~~**Neon's free tier suspends compute after inactivity.**~~ **Confirmed, and it does not need
  fixing.** Cold navigation to the demo workspace: **744ms**, and **1296ms** after a longer idle
  spell, against a warm median of **238ms** — a **3.1×** penalty. Real, and entirely covered
  by the 200ms progress bar. A heavier loading state at 1000ms was proposed and rejected on these numbers
  (ADR 024). Neon's paid tier removes the suspend; not worth it for a demo whose cold case is
  already under a second and a half.

- **Traffic baseline, before the link goes anywhere.** `pnpm db:usage` against production:
  3 distinct guest addresses, 56 guest requests, 2 signed-in users, 20 requests, across 8 days.
  Peak day 24 requests. Effectively all of it is the author, the tooling, and one cold reader.

  Two things follow. There is **no organic traffic yet**, so any claim about how the product
  behaves under load is theory. And the usage caps are nowhere near binding — 100/day per guest
  and 600 global, against a peak of 24 — which is worth knowing before anyone tunes them. Re-run
  it after the walkthrough goes out; that is when the number means something.

  `ipHash` counts **addresses, not people**: a shared network is one hash and a phone changing
  network is two, so it is a floor on distinct visitors rather than a headcount.

- **`@types/node` is two majors ahead of the runtime.** `engines` says `node: 24.x` and CI runs
  Node 24; Dependabot bumped the types to 26 in #91 and nothing compared the two. Types describing
  Node 26 APIs against a Node 24 runtime means typecheck can pass on something that does not exist
  when it runs — narrow, but it is the same silent-mismatch shape as a lockfile holding three
  copies of one package. Pin the types to `^24` rather than moving the runtime: which Node version
  this deploys on is a deployment decision, not one a dependency bot should make.

- ~~**A nonce-based CSP, to drop `'unsafe-inline'` from `script-src`.**~~ **Shipped.** The App
  Router inlines the RSC payload as `self.__next_f.push(...)`, so the nonce is minted per request
  in `proxy.ts`, set on the _request_ headers for Next to read, and paired with `'strict-dynamic'`.
  The measured objection did not hold: a nonce forces dynamic rendering, but 23 of 25 routes were
  already dynamic from the theme cookie (ADR 018), so it cost nothing. The rest of the policy was
  already closed — `img-src` and `connect-src` at `'self'` are what stop a model-authored markdown
  image pointing at an attacker's host, an exfiltration path the `img` component override had been
  guarding alone.

- **Changes gated on `VERCEL_ENV === "production"` ship untested.** Preview deployments take the
  other branch by definition, so the production path is unexercised until it is live — which is
  how `trustHost` took sign-in down. Worth deciding once, rather than per change: either add a way
  to force the production branch on a preview (a `FORCE_PROD_CONFIG` escape hatch read alongside
  `VERCEL_ENV`), or treat any such gate as knowingly unrehearsed and say so at the point of the
  change. There is one such gate today and it has been reverted; the next one should not have to
  rediscover this.

## From a deep review, 6 August 2026

Ordered by value as the review ranked them. Items 1 and 2 are done; 3–6 carry an action and a
trigger rather than a schedule, and 7 is closed.

- ~~**1. The vector search's workspace filter cannot use the HNSW index.**~~ **Done.** `chunks`
  now carries `workspace_id`, and the retrieval transaction sets
  `hnsw.iterative_scan = relaxed_order` — the column alone fixed nothing, which the measurement
  in [ADR 026](decisions/026-scoping-chunks-by-workspace.md) shows directly. The regression test
  forces the HNSW-first plan rather than waiting for a corpus large enough to produce it, and
  fails without the fix by returning an empty list.

  What made this the review's largest finding is worth keeping in one sentence: the filter sat
  on a joined table, so an HNSW-first plan returned the globally nearest `ef_search` rows and
  discarded the foreign ones afterward — a small tenant in a large table silently under-retrieves,
  and the refusal that follows looks exactly like the relevance floor working. The two-plan
  analysis is in the ADR.

- ~~**2. One request can cost an unbounded amount, and the caps cannot see it.**~~ **Done.**
  `parseMessages` now bounds turns (100), total characters (200k) and the question itself (8k),
  with four integration tests — three that the outsized are refused, one that an ordinary question
  still is not, because a guard that refuses everything passes the first three. The gap it closed:
  the limiter counts _requests_, not size, so a single enormous turn passed a cap designed for a
  normal one.

- ~~**3. Chat tokens may go unrecorded when the reader closes the tab.**~~ **Not a defect,
  measured.** A reader who closes the tab mid-answer is still metered and the turn is still
  stored.

  **The reason is an absence:** `streamText` is given no `abortSignal`, so a client
  disconnect does not stop generation — it completes server-side, `onFinish` runs, and both
  writes land. Proven with a slow model — `fakeChatModel` now takes a chunk delay, because at
  the default `0` a probe cancels a stream that has already finished:

  | consumer            | `onFinish`                                        |
  | ------------------- | ------------------------------------------------- |
  | read to completion  | fires; a chat usage row and the whole turn stored |
  | canceled mid-stream | fires; a chat usage row and the whole turn stored |

  Not "full usage": the fake model reports **zeroed** token counts on purpose, so nothing
  here can check a token total and the test asserts the row exists and the stored answer is
  complete. Saying more than that would be the mistake this entry is already about.

  **What ships is the inverse of the action this entry proposed:** an integration test
  pinning the behavior, and a note in `route.ts` saying the signal is deliberately absent.
  Forwarding `request.signal` is the obvious improvement and is what would introduce the bug
  described here — verified by making that change and watching the test go red.

  Half the reason is the SDK's rather than ours: `createUIMessageStream` drains the model
  stream in a detached loop with no `cancel` handler, so a canceled response does not stop
  consumption either. An `ai` upgrade could remove that half without touching this repo.

  **The entry overstated its source.** The review said `onFinish` is "_not guaranteed_ to
  run", flagged that it could not check against the installed SDK — "treat it as _worth
  confirming_ rather than confirmed" — and named the exact experiment to settle it. This
  entry recorded it as fact, converted "confirm" into "fix", and dropped both the caveat and
  the test. It also lost two things the review said: that `persist` is affected as well as
  the usage row, and that the caps survive regardless because the embedding row is written
  before the stream opens. Written up in `docs/code-review-notes.md`.

  **One residual, unmeasurable from here:** if Vercel terminates the invocation when a
  client disconnects, `onFinish` never gets to run whatever the SDK does. That is platform
  behavior, and answering it needs production instrumentation rather than a test.

- ~~**4. Two writes on a read endpoint polled every two seconds.**~~ **Done.** Both sweeps on
  `GET /documents` now sit behind `atMostEvery` in `lib/sweeps.ts` — the stale-document sweep
  once a minute, the usage prune once an hour. Two sweeps at 30 polls a minute is **60 writes
  a minute, down to about one**.

  Neither interval costs anything real: a document is only presumed dead after 10 minutes, so
  a minute of extra latency before it is marked failed is inside the noise, and retention is
  counted in days. The gate is per process, so a warm instance carries it between requests and
  a cold one sweeps once — which is the right way round, since the poll is the thing being
  thinned and a cold start is already paying for everything else.

  **The gate takes the work rather than answering "is it due?"**, which a review argued for on
  two grounds and both hold. A predicate that mutates can be read twice and acted on once, so
  any later refactor that checks it in two places silently disables the sweep with no test
  failing. And the interval must only advance once the work _succeeds_: a sweep that throws
  would otherwise burn its window, and since this endpoint is polled only while a document is
  processing, the next window can be much later than the interval. It uses
  `performance.now()`, which is monotonic, so a backward clock step cannot leave the deadline
  in the future and hold the gate shut.

  The clock is injectable, so the behavior is seven unit tests with no real time involved, and
  the route test asserts five polls produce one sweep and a sixth after the interval produces
  two — with the clock moved _forward_ rather than reset, because resetting it would shut the
  gate rather than open it if anything above had polled.

- ~~**5. Ingestion writes embeddings one row at a time.**~~ **Done.** `setChunkEmbeddings`
  now issues one `UPDATE … FROM (VALUES …)` per batch instead of one per chunk.

  **The entry's own framing survived a measurement that looked like it would overturn it.**
  Timed against Neon, 32 chunks fell from 1062 ms to 71 ms and 200 from 6501 ms to 192 ms —
  which reads as most of the 1.80 s ingest, until you notice the round trip from this laptop
  is **31.6 ms**, and 32 × 31.6 ≈ the entire loop. A colocated function pays ~1-2 ms, so on
  today's documents the saving is tens of milliseconds. The cost was always latency × chunk
  count, and the case is the 600-chunk ceiling, exactly as written.

  Two things came with it. The batch is now **atomic** — previously a mid-batch failure left
  some chunks written, and resume relied on `listUnembeddedChunks` catching up. And a
  same-workspace ownership filter that had no test now has one: a single statement joining
  `WHERE id = v.id` will happily match another document's chunk.

  A review then pointed out that the rewrite had left a redundant `SELECT` beside it — the
  filter was still being applied in JavaScript, from a set built by a preceding round trip, on
  the hot path the change was priced against. It is `AND chunks.document_id = …` in the
  `UPDATE` now: three round trips down to two, and the isolation guarantee moved out of a JS
  `Set` and into SQL, where this project already says it belongs. Not taken: inlining
  `chunks.workspace_id` and dropping the document lookup entirely. That column is denormalized
  and can drift (ADR 026), so the workspace check stays on `documents`, the source of truth.

  **Follow-up:** the README's ingestion table was measured on the deployed app and predates
  this. Re-measure after it ships rather than editing the numbers on the strength of a local
  benchmark.

- ~~**6. The upload is fully buffered before its size is checked.**~~ **Done.**
  `declaredBodyTooLarge` refuses on `content-length` before `formData()` is reached, with a
  64 KB allowance because multipart wraps the file in a boundary and part headers. The
  post-read check stays and is still the authority: the header is client-supplied, and a
  chunked upload sends none at all.

  Three things it turned up that the entry did not predict. The route had **no integration test
  of any kind**, because `after()` throws outside a request scope — so the happy path was
  unreachable until that was stubbed. Too-large was answered with `400` in one place and would
  have been `413` in the other, so both now return `413`; one reason, one status. And the first
  attempt at the regression test asserted a race rather than a fact, which is written up in
  `docs/code-review-notes.md`.

- **7. Smaller things, and one that is already right.**
  - **The unused GIN full-text index — kept, which was the review's own second option.**
    The review offered either a migration dropping `chunks_content_fts_idx`, or a line
    recording that it is retained deliberately. **Taken: the second.** The answer path
    never queries it, but `pnpm eval:retrieval` issues the query it exists for, through
    `retrieveLexical` — which is how ADR 021 reached its table and how anyone would
    re-check it. ADR 021 also already priced the write and found it invisible: ingestion
    is one ~1.8s embedding call for a 51-page PDF, and a GIN insert beside that does not
    show. Its distinction between the index (ongoing cost) and `lexical.ts`/`fusion.ts`
    (free at rest) is correct and is why only the index was in question.
    **Unmeasured:** whether the planner picks the index at 51 chunks — at that size it
    probably does not, so the argument above rests on the write cost, not on the read.
    **Revisit if:** ingestion stops being API-bound (item 5 would do that), or a corpus
    arrives large enough for the index's size to be worth measuring. This entry stays so
    the finding is not re-raised as new.
  - **`GET /documents/[documentId]` returns the whole row**, including `contentText`, to
    callers that want metadata. **Action:** select explicitly. **Do it when:** the source
    panel is touched again.
  - **`countAllRequestsSince` runs on every admitted request** — already tracked in its own
    entry, no new action.
  - **`recordUsage` swallowing errors** is deliberate and documented. **No action** — the
    review agreed, and it is worth keeping the entry so nobody "fixes" it later.

None of 3–6 is user-visible today. Each becomes real at a different scale, and the review's
framing is right: this is where the current design stops holding as data grows, not a list of
defects.

## From a review of PRs #107 and #108, 7 August 2026

- **`Strict-Transport-Security` is absent from `next.config.ts`.** Two passes over the header
  set — the original hardening and the nonce CSP — added `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy`, and neither added HSTS. It is
  the last gap in an otherwise complete set.

  **Check first, then act:** Vercel may already send it on the apex domain, in which case
  adding it in `next.config.ts` only duplicates a header. `curl -sI https://citeseek.app`
  answers it. **Do it when:** the answer is no — and note that `preload` is a one-way door,
  since removing a preloaded domain from the browser list takes months.

- ~~**`retrieveLexical` has no tiebreaker, so the eval is not reproducible to the last digit.**~~
  **Done**, 22 August 2026, on the second trigger: the follow-up rewrite will argue from
  `pnpm eval:retrieval`, and a stable sort is what makes "unchanged" mean something.

  It also gained the **first test this file has ever had** — it is off the answer path by design
  and excluded from the coverage thresholds, so nothing would have caught a reordering. Worth
  keeping: the obvious test, calling it twice and comparing, **passes without the fix**, because
  two identical queries in one session scan the same way. Only asserting the tied rows come back
  in id order fails, and it fails 3 times in 3.

  The original entry follows.
  It orders by `ts_rank_cd` alone; equal-ranked rows arrive in whatever order the scan
  produced. Moving the workspace filter onto `chunks` changed that order and moved lexical
  MRR@8 from 0.53 to 0.52 — one question sliding one rank, with `recall@8` unchanged.

  Harmless today: lexical is not in the answer path. It matters because an evaluation that
  wobbles between runs weakens every comparison made against it, and ADR 021's whole argument
  is a comparison. **Action:** add `chunks.id` as a final `ORDER BY` key. **Do it when:**
  `lexical.ts` is touched again, or before any future run of `pnpm eval:retrieval` is used to
  argue for a change — a stable sort is what makes "unchanged" mean something.

- **One unexplained E2E failure, recorded so a second one is not treated as the first.**
  `chat.spec.ts › when nothing relevant is found › says so, and cites nothing at all` failed
  once, on the first full run after installing Next 16.3.0. It then passed in isolation, on a
  full re-run, and on three consecutive runs of its own spec file — five clean observations
  against one failure, and the failure output was not captured.

  The leading guess is cold start rather than the retrieval change: it was the first request
  against a freshly built server and a suspended Neon branch, and the run logged "The
  destination stream closed early" from the web server. **No action** — a flake chased without
  a reproduction is a guess with a commit attached. If it recurs, capture the trace first, and
  note that this test is the citation-integrity guarantee, so it is the wrong one to learn to
  ignore.

  ↳ **It recurred, 8 August 2026, and the instruction above was not followed.** One test failed
  in a full run (95 of 96) and I re-ran before capturing anything, so which test it was is lost.
  Both sightings were the first run after a fresh build against a suspended Neon branch, which
  keeps cold start as the leading guess and is now the only thing supporting it.

  What the second one did establish is why there was nothing to capture: `playwright.config.ts`
  paired `retries: 0` locally with `trace: "on-first-retry"`, so **a local failure produced no
  trace by construction** — there is never a first retry to record. Now
  `retain-on-failure` off CI. The next recurrence leaves evidence whether or not anyone
  remembers to look for it, which is the only reason this entry gets to stay open.

  ↳ **Third sighting, same day, and the trace change paid for itself immediately.** Two tests
  failed, both on the refusal branch — "says so, and cites nothing at all" and "what the
  documents do cover". The captured page showed why: still "Searching the documents." with a
  **Stop** button and an empty answer. Nothing was wrong with the assertion; the request had
  not come back inside the 5s timeout.

  **Diagnosis, and it is not cold start.** Locally `workers` is unset, so Playwright runs ~8
  browsers on 16 cores, `fullyParallel`, all against the **remote** Neon branch `.env.local`
  points at. CI runs `workers: 1` against a Postgres container on the same machine. And the
  refusal branch is the slowest one in the route: it alone adds `countSearchableChunks` to
  tell "nothing matched" from "nothing indexed". Eight workers, one remote database, the
  branch with the extra round trip, a 5s ceiling.

  Confirmed by running the same suite serially: **96 passed with `--workers=1`**, having just
  failed twice in parallel.

  **No config change.** Serialising locally costs 35s → 1.5m on every run to fix an artifact
  CI cannot have, and raising the timeout would hide it rather than fix it. What was missing
  was the diagnosis, and this is it: **a local E2E failure on the refusal path is contention
  until proven otherwise — re-run with `--workers=1` before believing it.** That is also the
  answer to the earlier worry about learning to ignore this test: it is not ignored, it is
  explained.

## ~~A coverage threshold nothing runs~~, 11 August 2026

**Fixed, 12 August 2026.** `lexical.ts` excluded with a written reason, which puts `lib/rag/**`
at 90.51%, and CI's unit step now runs `test:coverage` instead of `test` — the same suite with
the v8 provider attached, so the bar is evaluated rather than described. One correction to the
diagnosis below: it says nothing imports the file. Nothing on the **answer path** does, which
is the part that matters, but `scripts/eval-retrieval.mts` imports it as
`await import("../lib/rag/lexical.ts")` — an explicit extension, which is why more than one
grep for it has come back empty. That is the difference between deleting the file and
excluding it, so the wrong version should not stay on the record.

Found while adding `lib/local/**` to `vitest.config.ts`'s thresholds: **`pnpm test:coverage`
has been failing, and no pipeline runs it.** CI runs `pnpm test`, `pnpm test:integration` and
`pnpm test:e2e` — coverage is a local command nobody had a reason to type.

```
ERROR: Coverage for branches (85.83%) does not meet "lib/rag/**" threshold (90%)
```

Reproducible on `develop` at `f0e8a8b`, so it predates local mode and is not caused by it.

**The cause is one file, and it is dead on purpose.** `lib/rag/lexical.ts` is at **0 of 6
branches**. It is the hybrid-retrieval implementation [ADR
021](decisions/021-hybrid-retrieval-measured-and-not-shipped.md) measured and rejected —
nothing on the answer path imports it, and it is kept as the evidence behind that decision.
The coverage glob counts it as production code anyway. Every other file in the directory is at
or near the bar:

| File                            | Branches      |
| ------------------------------- | ------------- |
| `lexical.ts`                    | 0/6 — **0%**  |
| `extract.ts`                    | 10/13 — 76.9% |
| `chunking.ts`                   | 31/35 — 88.6% |
| `eval-metrics.ts`               | 19/21 — 90.5% |
| `embeddings.ts`, `normalize.ts` | 11/12 — 91.7% |
| `fusion.ts`, `vector.ts`        | 100%          |

Excluding `lexical.ts` puts the directory at **90.35%**, over the line without writing a test.
That is the honest fix: the config already excludes `ingest.ts` and `retrieve.ts` with a
written reason, and "retained as the record of a rejected decision, on no code path" is the
same kind of reason. The alternative is deleting the file, which ADR 021 makes safe — the
measurement is in the ADR, not in the module.

**The larger item is the gate, not the number.** A threshold no workflow evaluates is
documentation, and this one silently stopped being true at some point nobody can name. Either
CI runs `test:coverage` or the thresholds should stop claiming to be enforced. Running it in CI
is cheap — it is the same unit suite with the v8 provider attached.

Not fixed on the local-mode branch: unrelated to that work, and a config change that turns a
job red belongs in a commit that is about the job.

## ~~Local mode stores offsets but not the text they index into~~, 11 August 2026

**Done, in the slice this entry said to do it in.** `LocalDocument.text` is written in the same
transaction as the chunks, and `lib/local/text-loader.ts` slices it for the source panel — so a
local citation resolves by the same offsets a cloud one does, which an E2E asserts with **zero**
requests to `/api/w/`. The pinning question this entry asked for is answered there.

Found by a review of the local-mode slices. `lib/local/ingest.ts` keeps each chunk's
`startOffset`/`endOffset`, and discards `extracted.text`; `LocalDocument` has no field for it.

That is fine for what shipped — nothing renders a local citation yet — but it is a hard
dependency for the slice that does. `components/chat/source-panel.tsx` resolves a citation by
slicing the **canonical document text** with those offsets, which is why the server writes
`contentText` before the chunks. Offsets alone address a string that does not exist locally,
and re-deriving it would mean re-parsing a file the browser also does not keep.

**Do it in the slice that renders local citations, not before**: add `text` to the stored
document, write it in the same transaction as the chunks, and the pinning question becomes
whether a local highlight lands on the same characters a cloud one does. The offsets test in
`lib/local/ingest.test.ts` says so in its comment rather than asserting it, deliberately —
there is nothing yet to assert against.

## Vercel Speed Insights: declined for now, 11 August 2026

Vercel suggests adding `@vercel/speed-insights`. Not taken, and the reason is not technical —
it is served same-origin, so the CSP would likely cope.

`app/(marketing)/privacy/page.tsx` states "There is no analytics, advertising or third-party
tracking." Speed Insights is analytics. Adding it makes a published privacy claim false, and
this project's rule is that the page changes in the same commit as the thing it describes,
never after ([ADR 025](decisions/025-paying-for-the-model-tier.md)).

The trade as it stands: a clean and unusual claim, against field data there is almost no
traffic to populate. The README's hand-measured TTFT and Lighthouse numbers already carry the
performance story.

**Revisit if the site gets real users.** Doing it properly then means one commit carrying: the
component, the privacy page's "what is never done" list, a line in the processor list naming
Vercel as receiving visitor metrics, and a check that the nonce reaches the injected script.

## Landing and branding, raised 12 August 2026

Four things noticed while reading the deployed site. The first three are design work; the
fourth is a defect with a diagnosis.

- ~~**A logo mark, and real icons.**~~ **Icons done, 17 August 2026** — drawn as vector in
  `scripts/brand/mark.svg` and rendered by `pnpm brand:icons`. The prediction here was that a
  32px mark and one sitting on an image are different designs; that held, and the icon was
  drawn for the small size alone. Whether the hero reuses it is now genuinely open rather than
  assumed. Still no symbol in the header.

- ~~**A hero image behind the landing headline.**~~ Currently type on a flat background. The
  constraint that decides the approach: `img-src` is `'self' data:` and ADR 032 keeps remote
  hosts to model weights, so this is a self-hosted asset, not a stock URL. It also has to
  survive both palettes and keep the headline at WCAG AA against whatever sits behind it —
  which is the part that usually fails, and which `paintedColorsOf` in `e2e/a11y.spec.ts`
  can measure rather than eyeball.
  **Done, 18 August 2026** — drawn rather than photographic, and placed beside the headline
  rather than behind it, which sidesteps the contrast problem entirely instead of measuring
  its way through.

- ~~**A sticky header, possibly translucent with a blur.**~~ `components/site-header.tsx:94` is
  `border-b` and nothing else. Two things to check if it becomes `sticky top-0`: the skip
  link must still land correctly, and `backdrop-blur` over a hero image is exactly where
  text contrast stops being a constant — the same measurement as above.
  **Done, 18 August 2026** at 85% opacity, contrast measured rather than eyeballed. Both
  concerns were real: the skip link needed `scroll-padding-top`, and the sticky band cost four
  `target-size` failures — each has its own entry below.

- **Still open. The usage table's bars drift left-to-right between rows.** `usage-view.tsx:115` puts the
  bar in the row-header cell beside the date, in a `flex items-center gap-2`. The numeric
  `<td>`s carry `tabular-nums`; **the date `<th>` does not**, so `2026-08-11` and
  `2026-08-09` occupy slightly different widths and every bar starts at a slightly different
  x. Two fixes, and they are not equivalent: `tabular-nums` on the date is one class and
  keeps the bar as an inline annotation, while giving the bar its own `<td>` aligns it by
  construction and is arguably better semantics — a `<th scope="row">` should identify the
  row, not carry data. The second needs a header cell for the new column, and an empty `<th>`
  is not free for a screen reader reading the table.
  **Done**, 20 August 2026, with the first: one class on the date. Measured by reading the bars'
  left edges — `171 171 170 171 171 171 171 171 167`, three distinct positions across 4px, against
  a single 172 after. The second was not taken: the bar is `aria-hidden` decoration of the Calls
  figure, so a column of its own would claim it is a datum the table reports.

## Local mode, found in review of the answering slice, 12 August 2026

Most of what this section listed was fixed in the follow-up; see
[ADR 034](decisions/034-answering-on-the-gpu.md). Two things were not.

- **The tokenizer is rebuilt for every question.** `generateLocally` calls
  `AutoTokenizer.from_pretrained` per turn, re-reading and re-instantiating 6.7 MB, when the
  pipeline returned by `loadChatModel` already carries one. Taking it from there means
  typing the pipeline as more than a call signature, which is why it keeps being deferred.

- ~~**The consent gate re-asks on every mount.**~~ **Fixed.** The question this entry said had
  to be decided first was the whole of it: `loading !== null` means a download _started_, so a
  two-state answer would have rendered the chat over weights still arriving. `chatModelStatus()`
  reports `idle | loading | ready` instead, and a mount arriving mid-download rejoins the running
  promise rather than starting a second — with no `aria-valuenow`, because the callback carrying
  the real byte count belongs to the mount that began it and inventing a number would be worse
  than admitting the percentage is unknown.

## ~~The worked example leaks into answers~~, 12 August 2026

**Fixed the same day — [ADR 035](decisions/035-where-the-worked-example-goes.md).** The example
moved into the system prompt and is now built from the retrieved passage; `cite` no longer
mentions an office, and real questions still carry clickable chips. The entry stays for the
reasoning. The unrelated paragraph at the end of it is still open.

Found in manual testing against a real CV, and it defeats the guarantee the project is built
on. `MARKER_EXAMPLE` in `lib/local/generate.ts` is sent as real `user`/`assistant` messages
between the system prompt and the question. Asked "you forgot to add the citation", the 0.5B
model replayed the example's assistant turn verbatim — "It closes at six" — renumbering the
marker to `[2]`, which **resolves**: the chip opens a passage of the reader's own document
that has nothing to do with the claim.

A wrong answer is survivable. A wrong answer wearing a citation that opens cleanly is the
failure [ADR 011](decisions/011-retrieval-and-citation-strategy.md) exists to prevent, because
the citation is what a reader checks it with.

**It reproduces on one word.** Asking `cite` returns "The passage [1] says the office closes
at six" every time — that is the example's _user_ turn, so the model is not merely echoing the
answer, it is treating the pair as retrieved material and answering out of it. Generation is
`do_sample: false`, so this is deterministic rather than unlucky. Whatever replaces the example
has to be checked against `cite`, `citation` and `cite again` specifically; a normal question
was never what exposed this.

**The fix to try**: move the example inside the system prompt as delimited illustrative text
rather than conversation turns. [ADR 033](decisions/033-answering-locally.md) measured the
system prompt with **no example** producing no markers at all; an example _within_ the prompt
was never tried, so this is not re-running a failed experiment. The regression probe is the
question that triggered it — "you forgot to add the citation" — and the bar is markers still
appearing on ordinary questions.

Related and separate, because it is model capability rather than prompt construction: asked
"do you use webgpu?", the model answered "Yes, I can run GPU code on my device" with no marker
and no refusal. Retrieval had cleared the floor on some chunk, and the model then answered from
its own knowledge against a system prompt that says it has none outside the documents —
including about this app. Worth considering whether an answer containing no marker at all
should be surfaced differently, since that is detectable where a plausible-looking leak is not.

## ~~An unresolvable citation is inert, and nothing says why~~, 12 August 2026

**Fixed — [ADR 036](decisions/036-saying-why-a-citation-did-not-link.md).** The invented numbers
are named under the answer, and the note says "unsupported" rather than "error", because nothing
failed. Its sibling — an answer citing nothing at all — took a second attempt and is
[ADR 037](decisions/037-an-answer-that-cites-nothing.md).

Found the best way possible: in production, on a real CV, by the person who wrote the rule.
The 0.5B model answered "Lucian developed React frontend applications [2]" when one passage
had cleared the floor, so there was no source 2. `linkCitationMarkers` did exactly what
[ADR 011](decisions/011-retrieval-and-citation-strategy.md) requires and left the marker as
literal text rather than linking it to nothing.

Then the reader typed "that citation is not clickable" — and the reader was the author of the
guard. **The property held and communicated nothing.** A dead number is indistinguishable from
a broken button, so the one moment the system catches a model inventing a source is the moment
it looks most broken.

Worth being careful with the fix. Styling every unresolved marker as an error would put a
warning in front of readers for something that is working, and on the cloud path it is rare
enough that nobody has hit it. The options, roughly in order of how much they claim: a muted
style with a `title`; a footnote under the answer naming how many markers did not resolve; or
counting them and treating a high rate as a signal about the model rather than the answer.
Any of them needs a decision about whether this is addressed to the reader or to us.

## Follow-up questions retrieve nothing, 12 August 2026

Same session. "Where did he use React?" answered; "where?" and "at which company?" both
refused, because `questionFrom` embeds the last message alone and a two-word follow-up carries
no retrievable meaning. The refusal copy is then actively misleading — it suggests rephrasing
or that the document may still be processing, when the truth is that the question was
understood only in a context retrieval never saw.

**This is not local-only, and that is the part worth being careful about.** The chat route
retrieves on the latest question too, so this reaches cloud mode — the default path, which
carries no experimental label. Deferring it is a decision about priority, not something the
`/local` badge covers, and the release notes should not imply otherwise.

Two fixes, and they are not alternatives — the second is worth doing whether or not the first
ever happens.

**The full fix: rewrite the query against the recent turns before embedding.** "where?" becomes
something carrying its own subject, and retrieval sees what the reader meant. A real feature
with a measurable before and after: the evaluation harness already scores recall over the golden
set, so a rewriting step can be shown to earn its place rather than argued for. It also has a
failure mode worth measuring — a rewrite that invents a subject retrieves confidently wrong
passages, which is worse than refusing.

**The quick fix: stop the refusal blaming the document.** It currently offers "check that the
document you have in mind has finished processing", which is false here and sends the reader to
inspect something that is working. A refusal that misdiagnoses is worse than a blunt one. The
wording should allow that a short follow-up may need naming its subject again — one sentence,
no retrieval changes, and correct regardless of what happens to the full fix.

**The quick fix is done**, 22 August 2026. The advice moved rather than being reworded: the
streamed sentence now states what happened and stops, and the panel below — which already branched
on the reason — carries the diagnosis. So the false half is gone from the `no_documents` case as
well as the follow-up one, where it had been showing for both.

The follow-up hint is on the `no_relevant_passages` branch only: _"A short follow-up needs its
subject again — only the last question is searched, not the conversation."_ Saying that where
nothing is indexed would be its own misdiagnosis, and a test pins that it does not appear there.

**The full fix stays open.** Its prerequisite was recorded as met when `retrieveLexical` got a
tiebreaker, and that was wrong until 22 August 2026: the tiebreaker was `chunks.id`, and ids are
minted per ingest while the harness re-ingests the corpus on every run. Runs are comparable now
that ties break on filename and chunk index.

**Measured, 22 August 2026, before building anything.** `FOLLOW_UP_SET` in `eval/golden-set.ts` is
ten information needs written twice — as a reader types them after a previous turn, and as they
would have to be written to stand alone. Scored against the same corpus, vector alone, with the
relevance floor off:

**recall@3 is 0.70 as asked, against 1.00 standalone.** Three of ten fail, and the standalone
column being a clean 1.00 means a perfect rewrite recovers all three — that is the ceiling, not a
guess. The floor being off is the caveat: the product puts a 0.40 floor in front of this, so a row
scoring 1.00 here can still be refused. `eval/distances.json` now records the closest distance for
each typed form, so that costs nothing to check — nine of the ten clear 0.40, and only "why?" at
0.407 is refused before retrieval is scored at all.

**Carrying a term does not predict the outcome.** "in writing?" holds a word straight out of the
passage it wants and scores 0.00; "who handles it then?" and "how much is it?" carry nothing
discriminative and score 1.00 — on a three-document corpus where one passage is the only one about
an amount. So the rewrite is worth roughly **three questions in ten**, and the wording of a
follow-up does not say which three.

**The set was rebuilt, because the first version could not have failed.** Five of its ten cases
expected the very sentence answering their own context turn, which scores 1.00 whether or not the
follow-up was understood — a case measures nothing unless its passage is one the previous turn
would not already have retrieved. A six-case version before that scored 0.83 for a related reason:
five of the six carried a discriminative term, because those are the follow-ups that come to mind
when you are writing examples rather than watching someone type. A mean over a set the author chose
is only as honest as the sampling, and the per-row table is in `eval/report.md` for that reason.

## ~~An answer that cites nothing at all~~, 12 August 2026

**Fixed — [ADR 037](decisions/037-an-answer-that-cites-nothing.md).** The deadlock below was
self-inflicted: every wording tried said something about the answer's _quality_, which needs to
know whether a sentence is a claim or a refusal. Stating only what happened — nothing here is
cited, and a refusal is expected to cite nothing — is true in both cases and needs no such
judgement. What remains open is the harder half, kept below the rule about resolving citations:
a marker that resolves proves the passage was retrieved, not that it supports the sentence.

The worse half of [ADR 036](decisions/036-saying-why-a-citation-did-not-link.md), split out
because the fix is not obvious. Asked "how many files can i upload?", the local model answered
**"you can upload up to 2 files"** — false, specific, confident, and carrying no marker. Rule 2
of the system prompt requires a citation on every factual claim, so this is a rule violation
with no artifact: nothing renders oddly, nothing is inert, and the reader has no signal at all.
The inert marker ADR 036 explains is the _detectable_ case; this one is invisible.

Counting resolvable markers is trivial. The difficulty is that **an uncited answer is sometimes
correct**: rule 4 says never attach a marker to a refusal, so a model that writes "the documents
do not cover that" is behaving exactly as told. A flat "this answer cites nothing" warning would
fire on the honest case as often as the fabricated one, and a warning that cries wolf on correct
behavior is worse than none — which is the same lesson the inert marker taught.

What would need deciding: whether a refusal is distinguishable from a claim without asking a
model to judge (the refusal path already emits `data-refusal`, so a _model-written_ refusal is
the only ambiguous case), and whether the answer is to warn, to re-prompt, or to treat a high
uncited rate as a signal about the model rather than about any one answer.

Related, same session, same root: "do you use webgpu?" answered "Yes, I can run GPU code on my
device", and "i can't see anything related to that on my pdf" produced a paragraph about code
quality metrics opening with "I don't have access to your PDF" — which also breaks rule 7's
"never describe your inputs". All of it is a 0.5B ignoring the prompt, none of it reachable on
the cloud path, and all of it an argument for what `/local` is labelled as.

## ~~The first demo chat after a cold start loses a race~~, 12 August 2026

**Partly fixed — `e2e/global-setup.ts`.** Two wrong diagnoses before that one, kept below because
the wrong ones are the useful part. Two consecutive cold builds then passed 122/122 where five in
a row had failed. The stale-build note at the end is still open.

↳ **13 August 2026: the warm-up was not the whole story, and "cold start" was the wrong name.**
The same three `chat.spec.ts` tests failed twice in a row on a _warm_ build, each showing
"Searching the documents." with a Stop button — a request in flight, not an error. They pass
individually, and the suite passes **126/126 with `--workers=1`**.

The line that explains it is in `playwright.config.ts`:

```txt
workers: process.env.CI ? 1 : undefined,
```

**CI runs serially and cannot hit this. Locally Playwright defaults to half the cores** — eight
here — so eight browsers put concurrent chat requests through one Next server and one Postgres,
and the slowest of them lose a 5 s expect. It got worse the day the machine had less free memory,
which is the tell: the failures track load rather than anything in the code.

So the warm-up is still worth having — it removed a real first-request cost — but the residual
failures are a local parallelism setting, not a defect. What is left to decide is whether local
runs should cap workers (reliable, roughly twice the wall clock) or keep the default and accept
that a local red is sometimes about the machine. The second is what the repository does today,
and it is the option that trains you to ignore a red suite.

`chat.spec.ts:99` ("says so, and cites nothing at all") failed four times across one afternoon
and passed on every re-run and in isolation. Treating it as noise was wrong; it has a shape.

Every failure came on the first full-suite run after a fresh `pnpm build`, and none on a re-run
against the same build. The saved snapshot shows no error state — the trailing `- alert` in it
is Next's route announcer, which is empty on every page — only the refusal text missing after
the 5 s `expect` timeout. So nothing failed; the first request to a just-started server did not
answer inside five seconds.

Worth confirming before fixing, because the obvious remedy is the wrong one. Raising that one
timeout hides whatever the cold cost actually is, and this suite is the only place the number
would ever be noticed — `webServer.timeout` already allows 120 s for the server to accept
connections, which is not the same as being ready to serve a route that touches the database.

↳ **What it actually was, after two wrong answers.** First guess: the route needed warming, so
`/demo` was fetched before the suite. It failed again, and worse — two tests instead of one.
Second guess: the first vector search paying for the HNSW index, since both failures were the
refusal tests, the only ones asserting on retrieval's own reply with no streaming to wait
behind. A warm chat POST was added, and the chat spec alone then passed on a cold build in
15.7s — but the full suite still failed.

The measurement that ended it: the warm-up reported `chat 200 in 592ms`. Retrieval was never
slow. The cause is that `fullyParallel` starts every worker the instant a build finishes, and
all twelve routes meet their first request simultaneously on a machine still busy from the
build. One warm path cannot help when the others are cold. Warming the routes the suite opens,
sequentially, fixed it.

**Both wrong guesses were plausible and cheap to disprove, and neither was disproven by
thinking harder.** The `592ms` line is what settled it — the same lesson as the unpdf worker
in the entry above: run the cheap measurement before reasoning further.

Related and separate: **`webServer.command` is `pnpm start`, so Playwright serves whatever
`.next` already exists and never builds.** A local `pnpm test:e2e` after an edit silently tests
the previous build — which happened repeatedly during this session and produced one confident
"the test fails" report against a bundle from another branch. CI builds first, so its results
stand. Either the command should build, or the docs should say `pnpm build && pnpm test:e2e` is
the only sound local invocation.

## Improving what the local model answers, 14 August 2026

`Qwen2.5-0.5B-Instruct` answers badly enough that it needed a label. Recorded here because the
transcripts that showed it will not survive this session, and because the order matters more
than the list.

Measured, on the seeded handbook, all with a passage retrieved and cited:

| question                               | answer                       | document says |
| -------------------------------------- | ---------------------------- | ------------- |
| "How many days of annual leave…?"      | "Employees receive [1] days" | 28 days       |
| same, pushed with "one working day?"   | "two days"                   | 28 days       |
| "…hint: answer is 28"                  | "Annual leave is 28 days"    | 28 days       |
| "you are wrong, document says 28 days" | one paragraph, then a loop   | —             |

The last of those is fixed ([ADR 033](decisions/033-answering-locally.md)); the first three are
the model. Note the shape: it answers correctly only when the question already contains the
answer, which is the signature of a model doing pattern completion rather than reading.

**1. Score local answers before changing anything.** `eval/golden-set.ts` and
`scripts/eval-retrieval.mts` already measure recall and MRR over a fixture corpus, and every
judgement about answer quality so far — including every one in this file — is a transcript and
an impression. Extending the harness to run a question through `generateLocally` and check the
expected quote appears in the answer would turn "it feels worse" into a number. Without that,
swapping models is argument. [ADR 021](decisions/021-hybrid-retrieval-measured-and-not-shipped.md)
is the precedent: a measurement killed the obvious answer, and nothing else would have.

**2. Then try a newer small model.** The pin is 2024-vintage. A 2026 1B-class instruct model —
Qwen3-0.6B, Llama-3.2-1B, Phi-4-mini — plausibly beats it at a similar download. Worth knowing
before anyone reaches for size: the **1.5B was already tried** and did not fix marker emission
(ADR 033), so parameters alone are not the lever. What changed that was the worked example.

**3. Cheap prompt experiments, once (1) can score them.** Two candidates. `RETRIEVAL_LIMIT`
passages plus the rules plus an example is a lot of context for a 0.5B, and fewer passages may
read better than more. And `markerExample` demonstrates a sentence, not a quantity — "1 days"
is exactly the failure a numeric exemplar targets.

**4. Constrained decoding, last.** Forcing `{ answer, citations }` would make the marker unable
to stand where a number belongs — the problem
[ADR 038](decisions/038-a-citation-that-cannot-be-read-as-content.md) could only mitigate. It is
also the most work for the least certainty: transformers.js has no real grammar support, so this
means post-parsing a shape the model was merely asked for.

**What none of this fixes.** A model that cites a real passage for a claim that passage does not
support still produces no signal — the marker resolves, the chip opens, the answer looks sourced.
That needs an entailment check, and it is a separate entry above.

## CI never runs the real local model, 14 August 2026

Raised by a review of the local-mode slice, and it is the structural reason every defect in that
code had to be found by hand in a browser rather than by a red test. `e2e/local-chat.spec.ts`
sets `__citeseekLocalEmbedder = "fake"`, which swaps in `fakeGenerator`, so no job ever runs
`loadChatModel` or `generateLocally` **against the real library**. `lib/local/generate.test.ts`
runs both against a mock of it, which is a different thing: it proves what we send, not what
transformers.js does with it.

**Most of the gap is now closed without a model.** Device selection, the `progress_total`
filter, the message array being exactly `[system, user]`, the loop detector and the abort call
are all asserted against the arguments handed to `pipeline` (`lib/local/generate.test.ts`), and
`lib/local/transformers-contract.test.ts` pins the two library behaviors that were established
by reading the bundle rather than by testing it.

**What is left needs a model, and the real one will not fit.** 756 MB from Hugging Face per run,
plus WebGPU on a runner with no GPU — the CPU path was measured at over sixty seconds for a
single answer, against a fifteen-minute job. The E2E suite is also deliberately free of any
network dependency on a model provider, for the reason `playwright.config.ts` already gives
about rate limits.

**The tractable version is a tiny model, node-side.** Something in the low megabytes, loaded
through the same `loadChatModel` path, generating a few tokens of nonsense — enough to prove
that generation actually stops when the criteria are interrupted, that `progress_total` fires
during a real fetch, and that the options object is accepted end to end. The open question is
whether it is downloaded (network in CI, the thing that suite avoids) or vendored (a binary in
the repository, which `public/onnx` is deliberately not). That choice is the work; the test
around it is small.

## ~~Limits for the default plan, and the paywalls that would replace them~~, 16 August 2026

Raised as product thinking rather than a defect: cap the free tier now, so the paid tiers have
something to be an upgrade _from_. Recorded with the numbers proposed and the objections worth
answering before any of it is built.

**Proposed**: 100 MB of uploads in total, 3 documents at once, 3 conversations, 100 saved
messages per conversation, and a token ceiling.

**"100 MB of uploaded files" measures something this project does not keep.** Files are
discarded once extraction finishes ([ADR 009](decisions/009-store-extracted-text-not-files.md));
what is stored is the extracted text and a vector per chunk. `documents.sizeBytes` is retained,
so summing it is easy — but it is a poor proxy for what a document actually costs. A 100 MB PDF
of scanned pages yields almost no text and almost no chunks; 100 MB of Markdown yields an
enormous amount of both. A cap on uploaded bytes limits the wrong quantity and would let the
expensive case through while refusing the cheap one. **Chunks, or total extracted characters, is
the axis that tracks cost** — and it is the one a reader will not intuit, so whichever is chosen
has to be said plainly in the interface rather than left as a surprise.

**100 saved messages collides with a constant that already exists.** `MAX_MESSAGES = 100` in the
chat route caps how long a transcript may be _in a single request_ — a different axis, a
different reason (the limiter counts requests, so one enormous turn would slip a cap built for a
normal one). Two limits called 100 that mean different things is a support conversation waiting
to happen. Pick distinct numbers, or name them so the difference is visible.

**A "My Documents" page needs a reason beyond the cap.** `DocumentList` already renders inside
the workspace, and documents are workspace-scoped. A separate page earns its place only if that
changes — a view across workspaces, say. Otherwise, it is a second route rendering the same
component against the same data.

**Every cap belongs in the query layer, not the interface.** The same rule tenant isolation
follows: a limit enforced by hiding a button is not a limit, and an integration test should
prove each one refuses rather than that the button is missing.

**None of these belong in `lib/usage`, which holds no limit of this kind.** What is there counts
provider calls in a rolling minute and a rolling day — a flow limit, and one that heals itself as
the window slides, which is why "try again shortly" is a complete answer to it. Every cap proposed
here is a stock limit: three documents stays three documents until someone deletes one. It never
heals, so its message has to name what to delete, and a caller cannot retry its way out. Extending
`enforceUsageLimits` to carry both is the obvious move and the wrong one — it would put two
refusals with incompatible remedies behind one call.

**The paywall and the limit are the same check.** This is the part worth designing now even if
nothing is built: make the refusal carry a typed reason from the start. The precedent to copy is
`decideUsage`, which returns a discriminated union — `reason: "rate_limited"` with a retry delay,
or `reason: "capacity_reached"` with the `scope` that ran out — so the route renders a decision it
did not have to re-derive. Then "you have used
your 3 documents" and "upgrade for more" are two renderings of one server decision, and adding
tiers later is a copy change rather than a re-plumb. Getting this wrong means the paywall becomes
a second enforcement path, which is how one of them ends up wrong.

**A plain dialog is the first rendering, and it is not a lesser version of the paywall — it is
the test of it.** Say the limit was reached, what the limit is, and what to delete to continue.
If that dialog cannot be written clearly, the limit is wrong rather than the copy: a reader who
cannot tell which of their three documents to remove has been given a number, not a rule. It
also has to be reachable — a cap discovered only by pressing a disabled button is the same
mistake as an inert citation with nothing saying why.

**Done**, 17–19 August 2026, as ADR 039 and the four caps. Two of the proposed numbers did not
survive the objections recorded above: storage counts extracted characters rather than uploaded
megabytes, since the files are discarded, and the saved-message cap is 40 rather than 100, which
was unreachable — the client resends the whole transcript, so at 100 saved the next request is
101 and the transcript guard refuses it as a bad body before any cap can name itself.

## ~~Metadata the site has none of~~, 16 August 2026

Neither social embedding nor search indexing is configured anywhere: no `metadataBase`, no
`openGraph`, no `robots`, no sitemap. Every page sets a `title`; only the marketing pages add a
`description`; nothing else exists.

**Social cards need branding first, and `metadataBase` regardless.** Without it Next cannot turn a
relative image path into the absolute URL a crawler needs, so the card silently renders bare.
Next's `opengraph-image` file convention handles the rest. No CSP work is involved — the platforms
fetch server-side, so `img-src` never applies. This is blocked on the logo and hero work above,
because the card is the image.

**The interesting half of SEO is not the tags — it is deciding what should be indexed at all.**
`/demo` mints a guest session on every visit, so an indexed `/demo` means crawlers minting
sessions on a schedule. `/w/*` calls `notFound()` for anyone without the credential, so a crawler
already gets a real 404 there and has nothing to index. The marketing pages and `/local` are the ones worth indexing, and saying so needs a
`robots` policy rather than a meta tag on each page. Worth doing in the same pass as a sitemap,
since both answer the same question.

**Done**, 18 August 2026: `metadataBase`, `app/opengraph-image.png`, `app/robots.ts` and
`app/sitemap.ts`. Robots disallows the side-effect routes, `/api/` and `/account`; the sitemap
lists the five pages worth indexing.

## ~~The local upload control is a bare file input~~, 16 August 2026

`components/local/local-upload.tsx` renders `<input type="file">` behind a "Choose a file" button,
while the only other upload in the product uses `components/documents/upload-dropzone.tsx` — drag and
drop, a described drop target, the same validation copy.

So this is reuse rather than design: the component exists. What it needs is a way to hand back the
selected file instead of posting it to a route, which is the same seam the source panel needed for
its loader.

**This is not an accessibility fix.** The input is `sr-only` behind a real button and has carried
`aria-label="Add a document to local mode"` since the commit that introduced it, so it was never
a violation. Whoever picks this up should not expect axe to report one fewer finding — the gap is
drag and drop, the described drop target, and one validation copy instead of two.

**Done**, 18 August 2026. The seam is a `send` prop replacing the upload, not an `onFile`
callback: the dropzone owns `uploading | queued | rejected` and local mode owns
`parsing | embedding`, so two state machines meet at one function. The reuse also exposed a
false claim — the dropzone carried a notice about the paid Gemini tier, which on `/local`
contradicted that page saying nothing is uploaded. That copy now lives with the caller.

## ~~No E2E can reach a plan cap~~, 17 August 2026

The stock caps bite in exactly one place — a signed-in reader's own workspace — and the Playwright
suite never reaches one. There is no authenticated E2E at all: GitHub OAuth cannot be driven from a
browser test, so every spec runs as a guest against the demo, which `accessToWorkspace` makes
read-only and whose conversations are never stored (ADR 013). So the document and conversation caps
have integration tests and no journey test, deliberately.

Found by adding `PLAN_LIMITS=off` to `playwright.config.ts` on the assumption that the suite would
otherwise trip the caps, then checking: the only upload in the suite is `/local`, which is entirely
in-browser, and nothing presses "New conversation". The setting was removed rather than kept —
unreachable configuration whose comment states a false reason is worse than none, and it would have
masked a real breach the day an authenticated spec appeared. **The same mistake this project keeps
recording: a guard written from a plausible claim rather than a measurement.**

**The trigger to revisit**: the first authenticated E2E. That needs a seeded signed-in session
(a pre-inserted user plus a signed cookie from `global-setup`, sidestepping OAuth), which is worth
building for its own sake — the entire signed-in half of the product currently has no journey
coverage. When it exists, `PLAN_LIMITS=off` becomes necessary for the unrelated specs and a
cap-specific spec becomes possible; both should land together.

**Done**, 19 August 2026: `e2e/signed-in.ts` and `e2e/plan-caps.spec.ts`. Two claims above were
wrong, both from reasoning rather than looking.

_The cookie is not signed._ Sessions are database rows, so it carries the `session_token` primary
key and nothing else. Inserting the row and setting the cookie is the whole handshake; none of
Auth.js's signing had to be reproduced.

_`PLAN_LIMITS=off` was not needed._ That followed from assuming one shared account. The fixture
creates a user and a workspace per test instead, so every count starts at zero and no spec can
approach a cap it did not set up — which also keeps the cap spec able to test caps, something a
global `off` would have made impossible. Isolation removed the configuration rather than requiring
it. Verified both ways: the two specs pass with limits on and fail with `PLAN_LIMITS=off`.

## ~~A malformed chat id is a 500, not the documented fallback~~, 17 August 2026

`resolveChatForTurn` (`lib/chats/queries.ts:111`) carries the comment "a mismatch falls back to the
most recent rather than erroring — a stale id should not lose the reader's question." That holds for
a well-formed uuid naming a chat that does not exist. It does **not** hold for a string that is not
a uuid: the value goes straight into the `where` clause, Postgres raises `22P02 invalid input syntax
for type uuid`, and the query throws before the fallback is reached.

`chatId` is client-supplied. `app/api/w/[workspaceId]/chat/route.ts:184` accepts any string, so
`{"chatId": "garbage"}` produces an unhandled error where the design says it should produce an
answer. Reachable only by a signed-in reader, against their own request, so the severity is low —
but the failure mode is precisely the one the comment promises cannot happen.

**Found by a test that meant to prove the fallback and used a malformed id to do it.** The test
failed loudly rather than passing for the wrong reason, which is the good version of this mistake:
the same family as the `[data-message-bubble]` selector and the `sr-only` contrast check already in
`docs/code-review-notes.md`, where the input could not reach the branch under test.

**The fix, when it is picked up**: refuse a non-uuid `chatId` at the route boundary where the body
is already validated, rather than teaching the query helper to parse. `parseMessages` is the
precedent — shape belongs with the other request-shape checks, and the helper stays about ownership.
Not done here because it is unrelated to the milestone's caps.

**Done**, 19 August 2026, and it was **five paths, not one**. Probing the others before writing the
fix found the same `22P02` behind `/w/<not-a-uuid>`, `/w/<id>/c/<not-a-uuid>`, and both document
routes — three bare 500s and two error pages served under a 200. The entry described the one place
a test happened to reach.

The body field is refused at the route as prescribed, since silently falling back would write the
turn into a conversation the caller did not name. The **path** ids are not: an id that cannot parse
names nothing, which is what an unknown id already means, so `isUuid` guards the lookup helpers
(`findWorkspaceById`, `listChatMessages`, `findDocumentInWorkspace`, `deleteDocumentInWorkspace`,
`renameChat`, `deleteChat`) and every one of them now answers exactly as it does for a well-formed
id that is absent. Verified side by side against `00000000-…-000000000000`.

`countChatMessages` and `appendMessages` are deliberately unguarded: their id comes from
`resolveChatForTurn`, which returns a row, never a client string.

## ~~The chat route is never told which conversation is open~~, 17 August 2026

**Found by manual testing of the saved-message cap, and it is not a cap defect.** At the cap the
refusal fires correctly; then the reader starts another conversation, returns to the full one, and
the assistant answers there — while the turn is written somewhere else. It reads as "it responded
but nothing saved".

`components/chat/chat-panel.tsx:67` constructs `new DefaultChatTransport({ api })` and adds no
body, so `chatId` is never sent. `app/api/w/[workspaceId]/chat/route.ts` therefore always reads
`requestedChatId` as `null`, and `resolveChatForTurn` falls through to `getOrCreateChat` on every
turn — which returns the **most recently updated** chat, not the one on screen.

Consequences, in order of severity:

- **A turn can land in a conversation the reader is not looking at**, whenever the open one is not
  the most recent. The transcript on screen and the transcript in the database diverge silently.
- **The saved-message cap counts the wrong conversation** for the same reason. It is a real cap on
  a real chat, just not necessarily the open one — which is why it looked correct at exactly 60 and
  then appeared to stop working.
- `resolveChatForTurn`'s `requestedChatId` parameter has never been exercised by the application.
  Every test that covers it constructs the request by hand, which is why the suite is green.

**The fix** is `prepareSendMessagesRequest` on the transport, adding `{ chatId }` to the body, with
the transport memoized on `activeChatId` as well as `workspaceId`. The server side already handles
it: validation, ownership and the stale-id fallback are all in place and tested. Worth an E2E or
integration test that drives the client seam rather than the route alone — the gap here was
precisely that nothing connected the two.

## ~~"New conversation" reloads the whole page~~, 17 August 2026

`/c/new` is a form POST answering `303`, so every press is a full document navigation: the whole
workspace re-renders, documents are re-fetched, and the chat panel remounts. Correct, and
deliberate — a `GET` that creates a resource is what the prefetch incident taught, and the POST is
what fixed it (`lib/links.ts`). The cost was recorded as "no middle-click, no open-in-new-tab" and
the reload was not, which understates it.

**Done**, 20 August 2026. A Server Action replaces the route: still a POST, so the prefetch guard
holds, but `redirect()` inside one navigates client-side and the form still works without
JavaScript. Measured 1 document load before and 0 after. Nothing was traded back — the reload was
never part of the trade, only the shape of the tool it was implemented with.

**Options, none of which reintroduce the prefetch problem:**

- A Server Action invoked from a client component, then `router.push` to the new chat. Keeps the
  write off `GET`, and the navigation becomes a client-side transition.
- `fetch("/c/new", { method: "POST" })` and push the returned id, which needs the route to answer
  JSON to a fetch caller while keeping the redirect for a no-JavaScript form post.

The first is the smaller change and keeps one code path. Either way the no-JavaScript case must
keep working, since the form is what makes that true today.

## ~~Model weights cached inside `node_modules` break the build~~, 18 August 2026

`pnpm build` failed with a Turbopack panic — `reading file … Qwen2.5-0.5B-Instruct/onnx/model_q4f16.onnx`,
`Insufficient system resources exist to complete the requested service (os error 1450)`. It
succeeded on retry, which is the shape of the problem: intermittent, and nothing to do with the
change being built.

`@huggingface/transformers` defaults its cache to `.cache/` **inside its own package directory**, so
running the real local model in Node writes weights into `node_modules`. On this machine that is
**3.1 GB**, including a 1.7 GB file. Turbopack traces the dependency graph for the middleware
entrypoint and reads what it finds there, and Windows runs out of resources on files that size.

The tests that touch it (`lib/local/embedder.test.ts`, `generate.test.ts`,
`transformers-contract.test.ts`) mostly stub the library; whatever downloaded these did so in
August during Milestone 7's model comparison. CI never hits it — a fresh runner has no cache, which
is why this only ever appears locally.

**The fix is one setting**: point `env.cacheDir` at a path outside `node_modules` wherever the
library is configured for Node, so weights live beside the repository rather than inside its
dependency tree. Deleting the directory clears it today and it returns the next time a model is
pulled. Worth doing before anyone else clones this and runs the local model, since the symptom
names a file nobody chose to create and a build that failed for no visible reason.

**Done**, 18 August 2026: `lib/local/model-cache.ts` sends it to `~/.cache/citeseek-transformers`,
overridable with `CITESEEK_MODEL_CACHE`. Applied on both model-loading paths — the two places that
call `pipeline()` — because nothing else in Node pulls a model, and a helper nobody calls would not
survive the next reader. The library's own `cacheDir` is the runtime check: it is null wherever
there is no filesystem, so the browser never reaches `process`.

## ~~A sticky header can obscure a control, and axe no longer sees it~~, 18 August 2026

Making the header `sticky` turned four a11y scans red on `target-size` — "all touch targets must
be 24px large, or leave sufficient space" — against the workspace's "Sign in to upload" button. The
button is 34px tall and passes on its own. axe counts only the _unobscured_ area, and a sticky
header covers whatever scrolls beneath it.

The scans were reached by `toBeVisible()` on a citation chip, whose scroll-into-view lands wherever
the answer happened to finish streaming. So the same commit passed with two tests on one worker and
failed with the full suite on eight: the gate's result depended on stream timing, not on markup.
Those two scans now run from `scrollTo(0, 0)`.

**What that stops catching**: a control partially covered by the header at some scroll offset. It is
a real WCAG 2.5.8 concern and it is not specific to this app — any sticky header has it, at some
offset, for some control. `scroll-padding-top: 4.5rem` in `globals.css` handles the cases the
browser scrolls itself (anchors, focus); it does nothing for a synthetic scroll, and nothing for a
reader who simply stops mid-page.

**Worth doing if it is ever picked up**: a deliberate test that scrolls a known control into the
header band and asserts what remains reachable, rather than discovering it by accident. That is a
different test from "does this page pass axe", which is why folding it into the existing scans was
the wrong place for it.

**Done**, 19 August 2026: `e2e/focus-not-obscured.spec.ts`, and the measuring changed the target.

The first attempt tabbed through a page asserting focus never enters the band. It passed with
`scroll-padding-top` **deleted**, so it was testing Chromium rather than this app: forward tabbing
scrolls an element to the _bottom_ edge, and even `Shift+Tab` backwards landed controls at top 88
against a header ending at 67. A test that cannot fail is worse than the gap it claims to close.

What does fail is **fragment navigation**, which scrolls its target to the very top — and every page
has one: "Skip to main content" put `#main` at top 0 under a 67px header, so the affordance whose
only users are keyboard users dropped them behind the nav. The second test covers the in-product
case, the `#conversations-heading` anchor the cap refusal redirects to, asserted on a heading a
guest can reach. Both fail with the line removed and pass with it.

Still not covered, and now known to be unfixable in CSS: a reader who simply scrolls so a control
sits half under the header. No author rule reaches a manual scroll.

## ~~A full conversation looks writable until you send~~, 18 August 2026

Reading the copy at every cap turned this up. At 40 of 40 saved messages the composer is enabled,
the Send button is live, and nothing on the page says the conversation is finished. The refusal is
correct once it arrives — the route returns 409, no answer is streamed, and the notice reads "This
conversation has reached its limit of 40 saved messages. Start a new conversation to keep going —
this one stays where it is." But it arrives **after** the reader has written the question, and the
question stays on screen unsaved beside a composer that still invites another.

The other three caps do better. The conversations cap renders its notice above the list on load,
before "New conversation" is pressed. The documents cap refuses at the file row and names the
failed upload to delete.

The fix is the same shape as the conversations cap: the page already loads the message count for
this conversation, so the notice can render on arrival and the composer can be disabled with it.
Worth checking whether the composer should be disabled at all, or only labelled — a disabled
control with no explanation is worse than an enabled one that refuses clearly.

**Done**, 19 August 2026: `messageCap` is computed in `workspace-view.tsx` and threaded to
`ChatPanel`, which renders the notice **above** the composer it disables — so the reason is reached
before the dead control, which answers the question this entry left open.

No extra query: `toUIMessages` maps rows one to one, so the transcript the page already loads _is_
the count the cap uses. Nor does it go stale — `onTurnComplete` already calls `router.refresh()`
for a signed-in reader, so the turn that reaches the cap re-renders the server component and closes
the composer behind itself.

## A missing workspace page is a soft 404, 19 August 2026

Found while checking that malformed ids behave like absent ones — they do, but the baseline itself
looks wrong. A GET to `/w/<well-formed-uuid-that-does-not-exist>` with a valid session returns
**200** with the streamed shell (`<title>Workspace · CiteSeek</title>`, no `h1`), not 404.

`workspace-view.tsx` carries the comment "`not-found.tsx` _with a 404 status_. Returning the body
directly gave the right words under a 200 — a soft 404 tells crawlers the URL is fine." So the
status was deliberately fixed once and is not what a plain request sees now. The likely cause is
that `notFound()` is reached during the streamed render, after headers have already gone.

Not chased here because it is unrelated to the ids, it predates that work, and it needs its own
measurement: whether a browser navigation and an RSC request differ, and whether `generateMetadata`
can decide early enough to set the status. **Check before trusting the comment** — either the
comment is stale or the behavior regressed, and both are worth knowing.

## The README screenshots predate the branding, 19 August 2026

`docs/images/*.png` were taken on 10 August. Since then the header gained the mark and became
sticky and translucent, so every thumbnail shows a header the live site no longer has — and the
screenshots are the first thing a reader looks at.

`pnpm demo:shots` regenerates them, but it defaults to `https://citeseek.app` and Milestone 7.5 is
not deployed yet, so running it today would recapture the old header faithfully. Pointing
`SHOTS_BASE_URL` at localhost is worse rather than better: the script needs the real providers,
because the fake embedder retrieves the wrong passage and the picture is _of_ a citation.

**Do it right after the v1.3.0 deploy**, against production, which is what the script is built for.

## The storage ceiling cannot be reached by one document, 20 August 2026

Found while testing the caps on the live URL. The plan allows 500,000 extracted characters, but
`MAX_CHUNKS_PER_DOCUMENT` is 600 and the measured density is ~455 characters per chunk — so a
single document tops out around **273,000 characters**. A 300,000-character upload never reaches
the storage check; it fails at chunking with "This document produces 659 chunks, above the limit
of 600. Split it into smaller documents."

Nothing is wrong here, and the chunk message gives advice that works: two 250,000-character files
ingest and land exactly on the ceiling. But "500,000 characters of storage" reads as something one
document could use, and it is not — the two limits are set independently and their interaction is
written down nowhere.

Worth deciding rather than leaving implicit: either say the per-document ceiling beside the plan
limit on the usage page, or raise `MAX_CHUNKS_PER_DOCUMENT` so one document can in principle fill
the plan. The first is a copy change; the second is a cost decision, since the constant is one
embedding call per chunk and exists to bound exactly that.

## ~~A navigation test that only fails in the full suite~~, 20 August 2026

`e2e/navigation.spec.ts` — "stays down for a navigation that resolves quickly" — failed twice on
19 and 20 August, both times in a full `pnpm test:e2e` run and never in isolation. It passes 3/3
and 4/4 when run alone, on a clean tree and on a working one, so the trigger is contention across
the eight parallel workers rather than anything in the diff that happened to be open. The
assertion is `expect(received).toBe(false)` receiving `true`, which reads as an indicator staying
visible past the point the test expects it gone.

**Both traces were discarded rather than read.** `trace: "retain-on-failure"` is configured
locally, so `test-results/` held exactly what this needs — and it was deleted while tidying before
staging, twice. That is the specific mistake this file already records under the E2E flake entry:
capture the trace first, then re-run. Nothing here should be guessed at until one is kept.

**Third sighting, 20 August 2026, and this time the trace was read.** It is not random. The
navigation took **848 ms** — `expect(page).toHaveURL(/\/privacy$/)` in the trace — while the bar
is suppressed for only the first **200 ms** (`APPEAR_AFTER_MS`). So the bar appeared and `__sawBar` reported
it correctly. The test asserts that `/about` → `/privacy` _completes inside 200 ms_, which is a
property of the machine rather than of the code, and eight parallel workers on one laptop do not
honor it.

**The fix is to assert the behavior instead of the speed**: after the click, wait out the
suppression window and check no bar appeared _within it_, however long the navigation then takes.
That keeps what ADR 024 actually promises and drops the part that only holds on an idle machine.
What it stops covering is the original intent — that a genuinely fast navigation shows no bar at
all — which cannot be tested where the navigation's speed is not controlled.

**Done**, 20 August 2026, by moving the threshold to a unit test rather than rewriting the
journey one. `components/navigation-progress.test.tsx` holds a controllable clock, so it asserts
the shipped `APPEAR_AFTER_MS` instead of hoping a real page renders inside it. The two end-to-end
tests that remain cover what only end-to-end can: that a real prefetch does not raise the bar, and
that a genuinely slow navigation raises and clears it.

## ~~Switching conversations rebuilds the workspace shell~~, 20 August 2026

The document reload is gone — a Server Action navigates client-side now — but the React tree below
`main` is still torn down and rebuilt on every conversation change. Measured by tagging live DOM
nodes and reading them back after the navigation: `header` is **the same node**, while `main`, the
documents section and the conversations section are all **rebuilt**. Click to a usable tree takes a
median of **410 ms** across five runs (143, 394, 410, 892, 906).

The cause is the route shape rather than anything anyone chose. `/w/[workspaceId]/page.tsx` and
`/w/[workspaceId]/c/[chatId]/page.tsx` are sibling segments that each render `WorkspaceView`
independently, and there is no `layout.tsx` between them — so React unmounts one page and mounts
the other. The header survives for exactly the reason the rest does not: it lives in a layout.

**The fix is a layout, and it collides with a deliberate coupling.** Moving the shell into
`app/(app)/w/[workspaceId]/layout.tsx` would preserve documents and conversations across the
navigation, leaving only the chat per-route. But `workspace-view.tsx` renders documents and chat as
one client unit on purpose: `hasReadyDocuments` has to track uploads as they finish, and a value
computed in the layout would be frozen. Splitting them needs the shared document state to move into
a client context provider in the layout, which the page then consumes.

Not a patch-release change. Worth doing before the composer work, since both touch the same surface.

**Done**, 21 August 2026 — [ADR 041](decisions/041-the-workspace-shell-is-a-layout.md). A route
group, `(workspace)`, rather than the bare segment: a layout at `[workspaceId]` would have wrapped
the usage dashboard in the document list and a chat panel, which this entry did not anticipate.

**The 410 ms above is wrong, and wrong in an instructive way.** Its five samples mix two
populations — the first switch of a session and every switch after it — so the median sat between
them and described neither. Separated, on the same machine and database:

|        | first switch          | steady-state median |
| ------ | --------------------- | ------------------- |
| before | 396, 894, 898, 902 ms | 67, 68, 70, 71 ms   |
| after  | 98, 102, 119, 120 ms  | 83, 85, 85, 86 ms   |

So the remount was never expensive once Next had the route payload cached; the **first** switch
was, and that one happens in every session. The steady state is **~16 ms worse**, consistently, and
why is unmeasured — the shell now re-renders where it used to be discarded, but naming that as the
cause without instrumenting it is the error this file keeps recording.

**On the steady-state number alone this change would not pay for itself.** What justifies it is
state: the document list keeps polling across a conversation change, the source panel stays open,
and scroll position survives. Speed was the wrong argument for the right change.

## ~~The composer: one row, and the send control inside it~~, 20 August 2026

Raised as a change request during the 1.3.1 testing pass, and deferred only because that release
was already cut. **A patch, not a minor**, by the policy the README already states — a minor bump per
milestone, a patch for work that is not one. This is not a milestone, and nothing new works
afterward that did not before. `v1.1.1` is the precedent, and it carried accessibility work. One component, shared by the workspace, the
demo and local mode: `components/chat/composer.tsx`.

**Two changes.** The textarea opens at `rows={2}` and should open at one, growing from there — the
autogrow and its `max-h-40` ceiling already exist, so this is the starting height only. And the
send control, currently a `<Button>` beside the field carrying `lucide-send` plus the word "Send",
should sit **inside** the field: bottom-right while the question is multi-line, right-hand side
while it is one. Icon only, no label.

**Three constraints, all of them from work already done here.**

- **The icon needs an accessible name.** Dropping the visible "Send" makes `aria-label` the only
  name the control has, and the Stop button that replaces it while streaming has the same problem.
- **WCAG 2.5.8 target size.** A small icon button in a corner is the shape that fails it, and the
  sticky header already cost four `target-size` failures once. `lucide-arrow-up` in a filled circle
  is both the common pattern and an easier target than a bare paper plane.
- **Focus order.** Inside the field means it sits between the textarea and whatever follows in the
  DOM; the keyboard path has to stay Tab-reachable and obvious, since Enter-to-send already exists
  and the button is the discoverable alternative to it.

**Sequence it after the workspace-shell layout work**, not before. Both touch this surface, and
doing the composer first means doing it twice.

**Done**, 21 August 2026. Measured on the demo: the field opens at **28px** where two rows was
about 48, and grows to 68 at three. The control is `size="icon"` — **32×32**, square, above WCAG
2.5.8's floor — beside a one-line question and bottom-aligned under a grown one.

**The fourth constraint was not in this entry.** Send and Stop were two `<Button>`s chosen by a
branch, so opening a stream unmounted whichever one had focus and dropped it to the body. They are
now **one** element whose type, label, handler and icon swap, which keeps the node — and the focus
— across the change. A test forces a remount with a `key` and goes red, so the property cannot be
lost silently.

`lucide-arrow-up` in a filled circle rather than a paper plane, as the entry predicted: a bigger
target and the more common pattern. `aria-label` is the only name either state has now, and axe
over the form is clean.

## ~~A signed-in reader can start conversations in the read-only demo~~, 20 August 2026

Found in review of 1.3.1, and **not a regression** — the route this replaced behaved identically,
which is why it is recorded rather than fixed in a patch.

`accessToWorkspace` returns `"read"` on the demo for every identified actor, including signed-in
users. `createConversation` authorizes with `"read"` and only special-cases a guest, so a signed-in
reader passes. `workspace-view.tsx` gates the Conversations section on `signedIn` alone rather than
`signedIn && !isDemo`, so the button renders on a workspace badged "Read-only demo".

Bounded, not harmless. `createChatUnless` counts `workspaceId` **and** `userId`, so the cap is per
reader and one person cannot exhaust the demo for everyone. What lands is rows in the demo
workspace that nobody expects to be writable, and a badge that reads as a promise the code does not
keep.

Two candidate fixes, and they answer different questions. Gating the section on `!isDemo` hides a
control that would work — the honest version if conversations in the demo are simply unwanted.
Authorizing with `"write"` refuses it at the boundary, which is where the badge's claim actually
belongs, and would need checking against the guest path that currently relies on `"read"`.

**Done**, 21 August 2026 — [ADR 040](decisions/040-read-is-the-right-to-ask.md), and both fixes in
that order: the boundary first, the interface second.

**This entry described the smaller half.** The button was not the leak. The chat route authorizes
`"read"` — correctly, since answering is a read a guest must be able to do — and then persisted on
`actorType === "user"`, where `resolveChatForTurn` falls back to `getOrCreateChat`. So a signed-in
visitor asking the demo **any question at all** created a conversation and stored both messages.
Hiding the button would have fixed nothing and closed the entry.

The rule that replaced both checks is one sentence: `"read"` is the right to ask, `"write"` is the
right to leave something behind. `canWrite` became a type guard on the way, which let two write
paths delete their guest branches rather than assert the same fact locally.

The guest path the entry said to check turned out to need no check and no branch: a guest cannot
reach `"write"` on any workspace, so the chats route's 403 was unreachable and is gone.

Not done here: rows that predate the rule still sit in the demo, unlisted and unreachable. The ADR
carries the query to count them before anyone decides whether to delete them.

## The signed-in E2E specs cannot run locally, 21 August 2026

Found while adding one. `e2e/signed-in.ts` opens its own database connection from
`process.env.DATABASE_URL`, and **nothing in the harness puts it there**: `playwright.config.ts`
loads no env file, and neither does `e2e/global-setup.ts`. The `env` block in `webServer` reaches
only the server Playwright spawns, not the test runner.

So `pnpm test:e2e e2e/plan-caps.spec.ts` fails on `develop` with
`password authentication failed for user "patra"` — postgres falling back to the OS user because
the URL is absent. It reproduces without any of this milestone's changes. These specs have only
ever run in CI, which exports the variable.

Exporting it by hand works, and the guard earns its keep on the way: `.env.local` points at Neon,
and `assertDisposableDatabase` refuses it rather than letting a browser test insert users into a
real database. `.env.test.local` is the one that works, and an exported variable beats Next's env
files, so runner and server then agree on which database they are looking at.

**Two candidate fixes.** `playwright.config.ts` could call `loadLocalEnv(".env.test.local")` the
way `vitest.integration.config.ts` does — one line, and the two harnesses would then agree. Or
`signed-in.ts` could fail with a sentence naming the missing variable rather than letting postgres
guess a username. The second is the more general fix and does not preclude the first: a fixture
that silently connects somewhere unintended is a category of confusion, not one bug.

**Not fixed here** — it predates this branch and belongs in a commit about the harness, not one
about a layout.

## Roving tabindex over the transcript — considered and rejected, 21 August 2026

Raised while adding a delete control to each question in Milestone 8: one control per exchange adds
a tab stop per exchange, between the transcript and the composer. Recorded so it is not re-raised as
new.

**It is the wrong pattern here.** Roving tabindex belongs to composite widgets — toolbars,
listboxes, grids, menus — where the container owns arrow-key movement between its items. A chat
transcript is content with embedded interactive elements, and the citation chip is the whole point
of the product.

**It would not help the readers it looks like it helps.** Screen readers in browse mode intercept
arrow keys for reading and never pass them to the page, so the handler would be inert for exactly
those users. It buys arrow navigation for sighted keyboard users only.

**It would not fix the stated problem.** Citation chips are already the majority of the tab stops:
a 20-exchange conversation carries roughly 60 of them before any delete control exists, so 20 more
is a 33% increase rather than a new category.

**What shipped instead**: a "Skip to the question box" link at the top of the transcript, matching
`app/layout.tsx`'s existing skip link — whose own comment already named this surface, saying "the
chat surface will be a long, streaming region, so a keyboard user must be able to jump past the
nav."

**Revisit if** the transcript ever becomes a genuine widget — a selection mode, or bulk actions
across exchanges — where a container owning arrow keys would stop competing with reading.
