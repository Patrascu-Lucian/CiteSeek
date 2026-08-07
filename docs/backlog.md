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

- **A page-shell component for the gutter.** Every route repeats
  `mx-auto w-full max-w-Nxl px-3 py-12 sm:px-6` — 18 files, including each `error.tsx`,
  `loading.tsx` and `not-found.tsx`. Unlike the bordered surfaces, these do not have to _agree_
  with one another, so this is tidiness rather than correctness. The gutter never travels alone
  either, which is why the honest abstraction is a layout component with a width prop rather than
  a padding utility — a class would standardize a quarter of the repetition and leave the rest.
  Touches enough files to want a commit with nothing else in it.

- **UUIDv7 primary keys instead of UUIDv4.** Postgres 18 ships a native `uuidv7()`.
  The schema currently uses Drizzle's `defaultRandom()`, which is `gen_random_uuid()`
  (v4, fully random), so every insert lands at a random point in the primary key's
  B-tree. v7 is time-ordered and gives sequential inserts — meaningful for `chunks`,
  where one PDF bulk-inserts several hundred rows. Deferred because it pins the schema
  to Postgres 18 specifically, and the gain is unmeasured at portfolio data volumes.
  Worth benchmarking during Milestone 1 ingestion work rather than assuming.

- Bundle-size budget enforced in CI for the chat route.
- Lighthouse CI as a PR gate rather than a manual measurement.

- **One rule for confirming a destructive action.** There are three now and they do not agree:
  deleting an account requires typing a word, deleting a conversation opens a dialog naming it,
  deleting a document happens on the first click. The graduation is defensible — account, then
  conversation, then a document that can be uploaded again — but it was arrived at one report at
  a time rather than decided. Worth settling as a single rule, with undo considered as the
  alternative to confirmation: a delete that can be taken back for a few seconds interrupts
  nobody and protects the same mistake.

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

- **The favicons are still the mark the header no longer uses.** `app/icon.png` and
  `app/apple-icon.png` are crops of the old generated lockup — a navy "C" over a magnifier,
  raster, on an opaque plate. The header went vector and monochrome without them, so the tab
  and the page now show two different identities. Not urgent, because both beat the
  create-next-app default they replaced, but it is the sort of thing a stranger sees first and
  it should be resolved in the same pass as the real mark rather than separately.

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

- **A page-shell component for the gutter.** Every route repeats
  `mx-auto w-full max-w-Nxl px-3 py-12 sm:px-6` — 18 files, including each `error.tsx`,
  `loading.tsx` and `not-found.tsx`. Unlike the bordered surfaces, these do not have to _agree_
  with one another, so this is tidiness rather than correctness. The gutter never travels alone
  either, which is why the honest abstraction is a layout component with a width prop rather than
  a padding utility — a class would standardize a quarter of the repetition and leave the rest.
  Touches enough files to want a commit with nothing else in it.

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
  fails without the fix by returning an empty list. Original entry follows.

  **1. The vector search's workspace filter cannot use the HNSW index.** `chunks` carries
  no `workspace_id` — scope is inherited through `documents`, so the filter lands on a
  joined table and Postgres has two plans, both of which degrade. Join-first is exact but
  computes a distance for every chunk in the tenant's corpus. **HNSW-first is the
  dangerous one:** the index returns the globally nearest `ef_search` rows and the join
  discards the ones belonging to other workspaces, so a small tenant in a large table
  silently under-retrieves. Under-retrieval here means the relevance floor refuses a
  question the documents answer — the failure looks like the product working.

  Verified: `chunks` really has no `workspace_id` column. The fix is to denormalize it
  (set at insert, backfilled by migration, indexed with the vector) so the filter and the
  index are on the same table. Today one demo workspace hides it entirely; it appears
  with the first real multi-tenant corpus, which is exactly when it is hardest to debug.

- ~~**2. One request can cost an unbounded amount, and the caps cannot see it.**~~ **Done.**
  `parseMessages` now bounds turns (100), total characters (200k) and the question itself (8k),
  with four integration tests — three that the outsized are refused, one that an ordinary question
  still is not, because a guard that refuses everything passes the first three. The gap it closed:
  the limiter counts _requests_, not size, so a single enormous turn passed a cap designed for a
  normal one.

- **3. Chat tokens may go unrecorded when the reader closes the tab.** `onFinish` never
  fires on an aborted stream, so the provider was paid and the limiter never learned. The
  gap favors the abuser: a client that disconnects on every turn is the cheapest way to
  spend quota without being counted.

  **Action:** record on abort as well as on finish, using whatever the SDK reports at that
  point rather than nothing. **Do it when:** guest traffic stops being three addresses —
  it is unexploitable at today's volume and the fix wants real numbers to check against.

- **4. Two writes on a read endpoint polled every two seconds.** `GET /documents` performs
  writes while the documents list polls it during ingestion. At one poller it is invisible;
  at several it is write amplification on a path nobody thinks of as a write.

  **Action:** guard them behind a module-level timestamp so they run at most once per
  interval per process. **Do it when:** touching that route for another reason — the change
  is small, but it needs the polling behavior re-verified, which is the expensive part.

- **5. Ingestion writes embeddings one row at a time.** One `UPDATE` per chunk where one
  statement per batch would do. A 51-page PDF is 32 chunks and finishes in 1.80s, so the
  cost is invisible; a 500-page document is where it stops being.

  **Action:** `UPDATE chunks SET embedding = v.embedding FROM (VALUES …) v` per batch.
  **Do it when:** someone uploads something large enough to notice, or before any claim
  about ingestion throughput goes in the README. The integration tests already cover
  ingestion, so this is a rewrite with a net underneath it.

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

- **`retrieveLexical` has no tiebreaker, so the eval is not reproducible to the last digit.**
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
