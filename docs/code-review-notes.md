# Code review notes

Review evidence: what generated or scaffolded code got wrong, what the fix was, and the
lesson worth keeping. One entry per correction, newest last. Source material for
"How I review AI-generated code as a senior engineer."

---

## Milestone 0 — scaffold

### `create-next-app` output was a starting point, not a result

- **Issue**: `app/page.tsx` was the default Next.js splash and `layout.tsx` carried
  `title: "Create Next App"`.
- **Fix**: replaced with a real landing page and proper metadata, restructured under
  `app/(marketing)/`.
- **Lesson**: scaffolder defaults are visible to anyone who opens the repo. A generator
  gets you a compiling project, not a finished one — the gap between those two is the
  part worth reviewing.

### shadcn's `init` installed its own CLI into `dependencies`

- **Issue**: `shadcn@4.15.0` added itself as a runtime dependency during init.
- **Fix**: moved to `devDependencies`.
- **Lesson**: tools that modify `package.json` need their diff read, not assumed. A
  build-time CLI in the production dependency graph ships bytes to users for nothing.

### `vite-tsconfig-paths` was redundant under Vitest 4

- **Issue**: the plugin was added out of habit — it is what most tutorials still show —
  and Vitest warned on startup that Vite now resolves `tsconfig` paths natively.
- **Fix**: dropped the dependency, set `resolve.tsconfigPaths: true`.
- **Lesson**: read startup warnings. Ecosystem advice ages badly, and a dependency that
  duplicates a built-in is a second place for the `@/*` alias to drift out of sync.

### ESLint 10 was incompatible with the Next.js config

- **Issue**: `pnpm lint` crashed with
  `TypeError: ... contextOrFilename.getFilename is not a function`. `eslint-config-next`
  declares `eslint: ">=9.0.0"`, but depends on `eslint-plugin-react`, whose latest release
  peers at `^9.7` and still calls the `context.getFilename()` that ESLint 10 removed.
- **Fix**: pinned `eslint@9.39.5`. Recorded in
  [`decisions/001-pin-typescript-5-and-eslint-9.md`](decisions/001-pin-typescript-5-and-eslint-9.md).
- **Lesson**: a package being on `latest` says nothing about whether its plugin ecosystem
  can consume it, and a direct dependency's peer range can be more optimistic than its own
  transitive deps allow. Check `peerDependencies` before upgrading a major.

### Unused import survived because lint had not run yet

- **Issue**: the landing page imported `CardContent` without using it.
- **Fix**: removed on review, before the first lint run existed.
- **Lesson**: the argument for wiring CI in the same slice as the first component rather
  than afterward — a gate that does not exist yet catches nothing.

### Default embedding dimension would have been silently unindexable

- **Issue**: Gemini's embedding model outputs 3,072 dimensions by default; pgvector's
  HNSW and IVFFlat indexes cap the `vector` type at 2,000. The column would have created,
  migrated and seeded without complaint, then fallen back to a sequential scan on every
  retrieval query.
- **Fix**: set the dimension to 768 before writing the schema. Recorded in
  [`decisions/002-embedding-model-and-dimension.md`](decisions/002-embedding-model-and-dimension.md).
- **Lesson**: the dangerous defaults are the ones that fail quietly and late. Worth
  checking a limit before the schema is written rather than after documents are ingested
  against it.

### A production 500 from a migration that was never applied there

- **Issue**: uploads on production returned a 500 with no body while the workspace page rendered
  normally. The code was identical to what worked locally; the _database_ was not. Migration
  0001 added `content_text` and `page_spans`, and had only ever been run against the dev
  branch. The split in symptoms was the diagnosis: `listDocuments` names its columns
  explicitly and kept working, while `createQueuedDocument` used a bare `.returning()` —
  which makes Drizzle emit `RETURNING` for every column the schema declares, including the
  two that did not exist.
- **Fix**: applied 0001 to production, then changed the insert to return an explicit column
  list so it asks only for what it reads.
- **Lesson**: two separate failures, and the second is the more useful one. Forgetting to
  migrate production is a process gap, logged in the backlog. But the bare `.returning()` is
  what turned a missing column nobody read into a total failure of the upload path — asking
  for more than you need converts unrelated schema drift into an outage. The give-away was
  that one query survived and the other did not, which pointed at the column lists rather
  than at the connection.

### An uploaded file sat at "Queued" until the page was reloaded

- **Issue**: found by using the app, not by any test. `DocumentList` seeded itself with
  `useState(initialDocuments)`, which captures the first value and ignores every later one.
  The upload control called `router.refresh()`, the server re-rendered with the new
  document — and the list never saw it. On an empty workspace this was doubly hidden: with
  no documents, the "is anything in flight?" check was false, so polling never started
  either. Nothing short of a manual reload could correct it.
- **Fix**: the first attempt was a `useEffect` syncing the prop into state. Two signals said
  that was the wrong shape — React's lint rule flags `setState` inside an effect as a
  cascading-render risk, and two tests broke. So the state was **lifted** instead: a new
  `DocumentsPanel` owns the documents, and the dropzone and list became children. The list
  is now presentational and owns no data at all.
- **Lesson**: copying a prop into state is a bug waiting for a second render, and the
  instinct to patch it with an effect keeps the bug and adds a render loop. Lifting removed
  the whole category rather than the instance. Two smaller notes: the dropzone now _awaits_
  the parent's refresh before clearing its row, so an uploaded file is never briefly
  displayed nowhere; and the tests that broke were asserting an intermediate state that the
  correct design does not keep — they were rewritten to assert the handoff itself, with a
  promise held open to observe both sides of it.

### A correlated subquery silently compared a table to itself

- **Issue**: `listDocuments` computed embedded-chunk progress with a correlated subquery
  inside a Drizzle `sql` template. Drizzle emits column references **unqualified** in that
  context, so
  `WHERE ${chunks.documentId} = ${documents.id}` rendered as `WHERE "document_id" = "id"` —
  and inside `FROM "chunks"` both names resolve to chunks' own columns. It compared a
  chunk's foreign key to its own primary key, matched nothing, and returned 0 for every
  document forever.
- **Fix**: replaced it with a `LEFT JOIN` plus `count(chunks.embedding)` and `GROUP BY`.
  Drizzle qualifies every reference in a join because it has no choice. Confirmed by
  dumping `.toSQL()` rather than inferring from behavior.
- **Lesson**: the more uncomfortable half is the test. The suite asserted
  `embeddedChunkCount` was **0** before embedding anything — and it passed, for entirely
  the wrong reason. A test whose expected value coincides with a broken implementation's
  output provides no signal at all. The fix was to assert two documents in one workspace
  with _different_ counts, which no single wrong number can satisfy. Worth applying that
  test generally: prefer assertions that a plausible bug cannot accidentally satisfy.

### A literal NUL byte made git treat a test file as binary

- **Issue**: CI failed `pnpm format:check` on `lib/rag/normalize.test.ts` while the same
  command passed locally. The file had CRLF line endings despite `.gitattributes` setting
  `* text=auto eol=lf`. Root cause was three characters: the test asserted NUL stripping and
  I had embedded a **literal NUL byte** in the string rather than writing `\0`. A NUL trips
  git's binary heuristic, binary files are exempt from line-ending normalization, so Windows
  CRLF was committed verbatim — and Prettier, which expects LF, rejected it on the Linux
  runner.
- **Fix**: rewrote the control characters as escape sequences (`\0`, ` `) in both the
  test and the character class in `normalize.ts`. The file became pure ASCII, git
  reclassified it as text, and normalization applied. Added `tests/repo-hygiene.test.ts`,
  which fails if any tracked non-binary file contains a NUL or a CR — verified by staging a
  deliberate offender and watching both assertions fire.
- **Lesson**: the symptom (a formatting error) was several steps removed from the cause (an
  invisible byte in a string literal), and the feedback loop was the worst kind — green
  locally, red in CI, one push per attempt. Control characters in source should always be
  escape sequences: a raw NUL or non-breaking space is invisible in a diff and unreviewable,
  which is exactly why nobody spots it. Worth noting the guard test was added not because the
  bug was hard to fix, but because it was hard to _find_.

### Sign-in worked but led nowhere: no workspace was ever created

- **Issue**: caught by manual testing on the deployed site, not by any test. Auth.js's
  adapter creates a `users` row and nothing else, and nothing in the codebase created a
  workspace to go with it. A signed-in account therefore owned nothing, and `/sign-in`
  redirected signed-in users to `/` — where the only call to action pointed back at
  `/sign-in`. Clicking "Get started" looked like a dead button.
- **Fix**: `getOrCreatePersonalWorkspace` (idempotent, so it also backfills accounts created
  before it existed), called from Auth.js's `createUser` event and again from a new `/w`
  entry point. `/sign-in` now redirects to `/w` rather than `/`.
- **Lesson**: every automated test passed. The unit tests covered the authorization rule,
  the integration tests covered the schema, and the E2E suite covered guest mode — which
  needs no user account and so never exercised this path. The milestone's own exit criterion
  was "sign in, see an empty workspace", and it had been declared met on the strength of a
  green pipeline. Worth remembering that a suite proves the paths it covers and says nothing
  about the one nobody wrote.

### Middleware imported `node:crypto` and 500'd every protected route

- **Issue**: `middleware.ts` imported `GUEST_COOKIE_NAME` from `lib/auth/guest.ts`. That
  module also imports `node:crypto` to sign tokens — and middleware runs on the Edge
  runtime, which has no Node built-ins. Every request to `/w/*` returned
  `500 Failed to load external module node:crypto` instead of redirecting. The build
  passed; only running the server revealed it.
- **Fix**: split the constants into `lib/auth/cookies.ts`, which imports nothing. Middleware
  imports from there; `guest.ts` re-exports for callers that want both.
- **Lesson**: a single named import drags its module's entire import graph into the bundle,
  and Edge/Node runtime boundaries make that a runtime failure rather than a compile error.
  Worth checking what a module _transitively_ pulls in before importing it into middleware.
  Also: `pnpm build` succeeding says nothing about whether the server runs.

### `CardTitle` renders a `<div>`, so pages had no heading at all

- **Issue**: an E2E test looking for `getByRole("heading", …)` on the sign-in page found
  nothing. Not a test bug — shadcn's `CardTitle` renders a styled `<div>`. Every page built
  around a card (sign-in, workspace-denied, demo-unavailable, the error boundary) had **no
  `<h1>` in the accessibility tree**, so a screen-reader user navigating by heading would
  find the page empty of structure.
- **Fix**: added `asChild` support to `CardTitle` via Radix `Slot`, then had each page pass
  its own `<h1>`. Fixing the primitive rather than the four call sites means the next card
  is correct by default.
- **Lesson**: the bug was only visible because the test queried the accessibility tree
  instead of a CSS selector. A `getByTestId` or class-based locator would have passed
  happily against a heading that no assistive technology could see — which is the argument
  for role-based locators as a design constraint, not just a style preference.

### The guest cookie's signature protected nothing

- **Issue**: `accessToWorkspace` returned `"read"` for the demo workspace unconditionally,
  including for a `null` actor. So a forged guest cookie granted exactly what having no
  cookie granted, and the HMAC verification had no observable effect. Found because an E2E
  test asserting "a tampered cookie is rejected" failed — the app cheerfully rendered the
  demo.
- **Fix**: `accessToWorkspace` now denies anonymous requests outright. An invalid or expired
  token resolves to `null` and is refused, which is also what Milestone 3's per-guest rate
  limiting will need.
- **Lesson**: a security mechanism that nothing depends on is decoration. The test was worth
  writing precisely because it asked "what does this actually prevent?" and the honest
  answer was "nothing yet". Recorded in
  [`decisions/005-guest-sessions-outside-auth-js.md`](decisions/005-guest-sessions-outside-auth-js.md).

### Asserting on error message text instead of SQLSTATE codes

- **Issue**: the first draft of the database integration tests asserted failures with
  `.rejects.toThrow(/unique/i)` and similar. Four of eight tests failed — not because the
  constraints were missing, but because Drizzle wraps driver errors in its own
  `"Failed query: insert into ..."` message, so the Postgres detail never appeared in
  `error.message`.
- **Fix**: unwrapped `error.cause` and asserted on the SQLSTATE code instead — `23505`
  unique violation, `23503` foreign key, `23502` not-null, `22000` data exception. The
  actual codes were discovered by running a throwaway probe script against the database
  rather than guessed.
- **Lesson**: error _messages_ belong to whichever library happens to be wrapping them and
  change between releases; SQLSTATE codes are part of the Postgres wire protocol and do
  not. A test that matches on message text passes for the wrong reason today and fails for
  the wrong reason tomorrow.

### `@next/env` broke silently under Vitest's transform

- **Issue**: `drizzle.config.ts` and the seed script loaded `.env.local` via
  `@next/env`'s `loadEnvConfig`, which worked when Node executed them directly. Reused in
  `vitest.integration.config.ts`, the whole suite failed with "DATABASE_URL must be set" —
  `@next/env` is CommonJS, and its default-export interop does not survive Vite's transform.
- **Fix**: replaced it everywhere with `lib/env/load-local-env.ts`, a four-line wrapper over
  Node's built-in `process.loadEnvFile`. The `@next/env` dependency was removed entirely.
- **Lesson**: a CJS package can work under `node` and fail under a bundler while looking
  identical in source. Where a Node built-in covers the need, it has no interop surface to
  get wrong — and one fewer dependency to keep current.

### `--font-sans` was self-referential, so the body font never applied

- **Issue**: `shadcn init` wrote `--font-sans: var(--font-sans)` into `app/globals.css`,
  assuming the layout defines `--font-sans`. `create-next-app` had named the same font
  `--font-geist-sans`. The result was a circular reference: every `font-sans` utility, and
  `--font-heading` which derives from it, resolved to nothing and the page silently fell
  back to the default sans-serif. Confirmed by grepping the built CSS, which contained the
  literal `--font-sans:var(--font-sans)`.
- **Fix**: pointed it at the name the layout actually defines,
  `--font-sans: var(--font-geist-sans)`, and left a comment naming the trap.
- **Lesson**: found while checking an IDE inspection that was itself a false positive — the
  editor flagged `--font-geist-mono` (which resolves fine at runtime) and missed the broken
  variable two lines above. Two scaffolders each generated valid code; the defect only
  existed at the seam between them. Worth verifying styling assumptions against built
  output rather than trusting that the page "looks fine", because a font fallback is
  invisible unless you know what you were supposed to be seeing.

### `pnpm dlx auth secret` runs the wrong library's CLI

- **Issue**: `.env.example` recommended `pnpm dlx auth secret` to generate `AUTH_SECRET`.
  The `auth` package on npm is **"The CLI for Better Auth"** — a different auth library
  from Auth.js/NextAuth. Running it wrote a `BETTER_AUTH_SECRET` key instead, so the
  variable the app actually reads stayed empty. There is no `@auth/cli` package.
- **Fix**: replaced the instruction with `openssl rand -base64 32` and a Node one-liner,
  and added a note naming the trap. The already-generated value was CSPRNG output, so it
  only needed renaming rather than regenerating.
- **Lesson**: short, generic npm package names get claimed by whoever registers them
  first, and `dlx`/`npx` will happily run a package you did not mean. Prefer scoped names
  or a primitive (`openssl`, `crypto.randomBytes`) for something as load-bearing as a
  signing key — and check that the tool wrote the variable you expected, not just that it
  exited 0.

### shadcn primitives were wrongly excluded from formatting and linting

- **Issue**: `.prettierignore` and `eslint.config.mjs` both excluded `components/ui/`,
  reasoning that registry code is vendored and re-syncing it would create diff churn. The
  visible result was `button.tsx` and `card.tsx` shipping without semicolons while every
  other file in the repo had them. Caught on review by reading the actual file.
- **Fix**: removed both exclusions and formatted. The components then passed the full
  type-aware ESLint ruleset with zero errors, so the exclusion had bought nothing.
- **Lesson**: shadcn/ui copies source into the repo for you to own and edit — it is not a
  dependency, and treating it like one produced inconsistent formatting a reader would
  notice immediately. The churn being avoided was hypothetical and rare; the inconsistency
  was real and permanent. When an exclusion is added "just in case", check whether the
  thing being excluded would actually have failed.

### A relevance filter in `WHERE` would have silently defeated the vector index

- **Issue**: the first draft of the retrieval query applied the relevance floor the obvious
  way — `WHERE embedding <=> $query <= 0.6`, alongside the workspace filter, with
  `ORDER BY ... LIMIT k`. It returns correct rows, and on the small data volumes a portfolio
  project sees it would have looked perfectly fine forever.
- **Fix**: split into two steps. The inner query is the shape an HNSW index can actually
  accelerate — order by the distance operator, take the top k — and the floor is applied in
  an outer select over those k rows. Same results, index still used.
- **Lesson**: an approximate nearest-neighbor index answers "the nearest k", not "everything
  within distance x". It walks its graph outward from the query point; a threshold predicate
  isn't a question that graph can answer, so the planner falls back to computing a distance
  for every candidate row. The tell is that nothing breaks — you get the right answers via a
  sequential scan, and the index you carefully created in migration 0000 sits unused until
  the table is large enough for it to matter, which is the worst possible moment to find out.

### A memoized markdown renderer silently froze citation state

- **Issue**: `Answer` passed the open citation down to the chip through
  `Streamdown`'s `components` prop — the obvious way, and it typechecks, renders, and
  half-works. Clicking a chip opened the passage, but the chip never showed itself as
  pressed. `Streamdown` wraps its output in `React.memo` with a custom comparator that
  only inspects `translations`, `prefix` and `dir`, so a changed `components` closure
  never reaches the DOM.
- **Fix**: moved citation state into a React context and made the `components` map a
  module-level constant. A context update re-renders consumers even when a memoized
  ancestor declines to re-render, and the stable object identity is what the memo wanted
  in the first place.
- **Lesson**: `React.memo` with a _custom comparator_ is not the same contract as
  `React.memo` alone — the default compares every prop, a custom one compares whatever
  its author thought mattered. Anything outside that list is invisible to it, including
  render props and component overrides. Worth reading the comparator before threading
  state through a third-party renderer, because the failure has no error: the feature is
  simply inert, and only a test that asserts the _visual_ state rather than the callback
  catches it. The test that clicked a chip and checked the panel opened passed the whole
  time.

### A modal source panel hid the thing it was there to verify

- **Issue**: the citation panel was built on a standard modal sheet — overlay, focus trap,
  page behind marked `aria-hidden`. That is the correct default for a dialog, and wrong
  for this one. Checking a citation means reading the claim and the cited passage
  _together_; a panel that dims and hides the answer removes half of what the reader came
  to compare. The tests found it indirectly: the chip's `aria-pressed` state became
  unassertable, because `getByRole` respects `aria-hidden` and the chip was now behind a
  modal — which is precisely the same reason a real user could no longer see it.
- **Fix**: `modal={false}`, no overlay, and `onInteractOutside` prevented so clicking back
  into the conversation does not dismiss the panel. Radix still moves focus into the panel
  on open and restores it on close, and Escape still dismisses; what is given up is the
  focus _trap_, which was never wanted here.
- **Lesson**: "it's a dialog, use the dialog primitive" imports a set of defaults designed
  for interruption — demand attention, block everything else, return when dismissed. A
  reference panel is the opposite: it exists to be read alongside. Worth asking what each
  default is _for_ before accepting it, and noticing when a test becomes awkward to write
  because the accessibility tree is telling you the same thing a user would.

### Transcript order was random, and only a three-message test could see it

- **Issue**: `messages` were ordered by `created_at`, with the primary key as a tiebreak.
  Both rows of a turn — the question and the answer — are written by a single `INSERT`,
  and `created_at` defaults to `now()`, which in Postgres is the **transaction** start
  timestamp, not the wall clock at row creation. So both rows carry the _identical_
  timestamp and the tiebreak decides, and the primary key is a random UUIDv4. A reloaded
  conversation could render the answer above the question.
- **Fix**: an explicit `position` column with a unique index on `(chat_id, position)`,
  assigned from the current maximum on each append. `chunks` already solved exactly this
  with `chunkIndex`; the precedent was there and I did not follow it.
- **Lesson**: two things. `now()` is not a clock — it is fixed for the whole transaction,
  which is what makes it useful for consistency and useless for ordering rows written
  together. `clock_timestamp()` is the one that advances. And the test that caught it only
  did so because it wrote **three** messages across **two** calls; a two-message test would
  have passed roughly half the time, which is worse than failing. When ordering is the
  property under test, the fixture has to be big enough for a wrong order to be visibly
  wrong.

### The same stale-state bug, one level up

- **Issue**: after an upload finished processing, the chat composer stayed on "Nothing to
  search yet" until the page was reloaded by hand. `hasReadyDocuments` was computed in the
  workspace page — a Server Component — and passed down, so it was fixed at server-render
  time. `DocumentsPanel` meanwhile polled and updated its own private copy of the document
  list. Two copies of the same state, and only one of them moved.
- **Fix**: lifted `documents` into a single client component that renders both sections, so
  the flag is derived on every render from the same state the list shows. `DocumentsPanel`
  went away — with the state above it, it was only a layout wrapper.
- **Lesson**: this is the _second_ appearance of the same bug. The first was `DocumentList`
  seeding `useState(initialDocuments)`, which captured the first value and ignored every
  later one. Both look different on the surface — one a copied prop, one a value frozen at
  server render — and both are "a second copy of state that stops tracking the first". The
  Server Component boundary makes it easier to reintroduce, because a value computed there
  _looks_ like ordinary derived state while actually being a snapshot.

  The regression test was checked against the old behavior before being kept: reverted to
  the frozen prop, it fails; with the fix, it passes. A test for a bug you cannot make fail
  again is a test you have not verified.

### The demo went silent because config and data came from different machines

- **Issue**: the seeded demo document returned "I couldn't find anything relevant" for every
  question on production, while a signed-in user's own uploads answered correctly. The seed
  had embedded that document with the deterministic **fake** embedder, so its vectors and the
  live query's vectors came from two models that share no geometry. Every distance was
  meaningless noise, nothing cleared the relevance floor, and the refusal path — working
  exactly as designed — reported it as "no relevant passages".

  Nothing was misconfigured. `.env.local` sets `EMBEDDINGS_PROVIDER=fake` so development
  costs no quota; the deployed app has it unset and defaults to the real provider. Both are
  correct. Seeding production from a laptop combined **the laptop's configuration** with
  **production's database** — an environment that exists nowhere else and that no test covers.

- **Fix**: the seed now refuses to write fake embeddings to a remote database _unless the
  provider was exported deliberately_, and prints both the target host and the embedder it
  resolved before doing anything. The first version of the guard keyed on "is the host
  localhost" and was wrong — it blocked the ordinary local workflow, because the development
  database is a remote Neon branch too. The distinction that actually matters is
  **provenance, not value**: a fake you exported is a decision, a fake `loadEnvFile` supplied
  is an accident. That also rules out putting the escape hatch in `.env.local`, where it would
  authorize the very thing it caused.

- **Lesson**: an environment is three separate things — code, configuration and data — and a
  script run by hand mixes them from different sources. That hybrid is untestable by
  construction: it only exists while someone's terminal is open. The defense is not a better
  test, it is for any script touching something remote to **state what it resolved** before it
  acts. Both symptoms here were invisible in the output: the seed reported "3 passages
  embedded" and looked entirely successful, and a later run silently hit the development
  branch and reported success there too. Neither line named the database or the model.

  A related trap surfaced while fixing it: `process.loadEnvFile` deliberately does _not_
  override variables already exported, so a file quietly fills in every value you forgot —
  which is convenient until the value that matters is one you did not know was set.

### A citation the model wrote in a form the parser did not know

- **Issue**: found on the deployed app. An answer drawing on two passages rendered
  `[1, 2]` as literal text rather than two chips. The marker pattern matched a single
  number — `/\[(\d+)\](?!\()/` — and the system prompt said only that "a sentence drawn from
  more than one passage carries more than one marker", which the model reasonably satisfied by
  writing one bracket containing both.
- **Fix**: the pattern now accepts a comma-separated group and emits one link per marker, so
  `[1, 2]` becomes two adjacent chips. A group is all-or-nothing: if any member does not
  resolve, the whole thing stays literal text, because linking the valid half would silently
  drop an invented citation and make the answer look better sourced than it is. The prompt now
  also asks for `[1][2]` explicitly — but the parser is the thing that had to be lenient,
  since prompt wording is a request and output format is not guaranteed.
- **Lesson**: the tests asserted the format _we specified_, and the model produced a different
  one that satisfied the same instruction. Every test passed, on both sides of the boundary,
  because both sides were written from the same assumption. When an interface is defined by a
  prompt rather than a type, the parser has to accept the range of things a reasonable
  generator might emit, not only the one the prompt asked for — and only production traffic
  reveals what that range actually is.

### The model cited passages while saying they contained no answer

- **Issue**: found by poking the deployed app, then reproduced. Roughly one run in four, a
  refusal came back as "The provided passages do not contain information to answer your
  question `[1][2]`" — citing sources while denying they held the answer. The markers resolved,
  so real chips rendered, pointing at unrelated text. Nothing in the pipeline was broken: the
  parser, the marker mapping and retrieval all did their jobs. The prompt told the model to
  cite every factual claim and said nothing about what a marker _means_.
- **Fix**: an explicit rule — a marker asserts "this sentence came from that passage", never
  attach one to a sentence a passage does not support, and a refusal cites nothing. Measured
  against the live model before and after: 1-in-4 became 0 of 9, while a control question the
  passages genuinely answered still cited correctly 3 of 3. The control was the point; a rule
  that suppressed citations everywhere would break the product's central claim while looking
  like a fix.
- **Lesson**: two things. First, I diagnosed this wrong twice before measuring — blaming the
  prompt broadly, then blaming the demo fixture, on three anecdotes from different sessions.
  The model is non-deterministic, so _any_ theory fits three samples. Twelve calls against a
  fixed prompt settled it in about a minute, and that should have come first.

  Second, prompt rules are requests rather than guarantees, so they belong behind a structural
  defense rather than in front of one. This rule reduces how often the model misbehaves; what
  makes a regression harmless is that the client refuses to render a marker with no matching
  source. Tests can assert the rule is present and nothing more — the behavior it asks for is
  only observable against the real model, which no suite here runs.

### A citation chip that worked perfectly and could not be seen

- **Issue**: citation markers rendered as bare gray numbers with an unexplained gap between
  them, indistinguishable from the surrounding prose. The cause was a single color: the
  assistant message bubble is `bg-muted`, and the chip was also `bg-muted`. The pill was
  drawn every time, in exactly the color behind it. The "unexplained gap" was its own
  padding, invisible for the same reason.
- **Fix**: `bg-background` with a hairline `ring-border`, so the chip contrasts against the
  bubble rather than against the page. The selected state keeps its filled treatment.
- **Lesson**: every test passed, and they were reasonable tests. The component suite asserts
  the chip exposes the right accessible name, invokes the right callback, and toggles
  `aria-pressed`. All three were true of a control nobody could see. **A test that queries the
  accessibility tree proves a control exists and works; it cannot prove it is visible.**

  Worth being precise about the gap, because it is easy to assume automation covers it: axe
  would not have caught this either. Contrast checks compare text against its background, and
  `text-muted-foreground` on `bg-muted` is a designed pair that passes. What failed was
  affordance — the control did not distinguish itself from the prose — and no automated check
  tests affordance. "axe clean" is a lower bar than it sounds.

  The practical correction is to the review process rather than the code: when the question is
  how something _looks_, read a screenshot, not a transcript. Copied text preserves the words
  and discards spacing, color, and the distinction between a chip and a character — which is
  the entire content of this defect.

### A test that only passed on the machine that had the secret

- **Issue**: CI went red on four chat-route integration tests with "AUTH_SECRET is required to
  hash client addresses". Usage recording hashes the caller's address, so the chat route
  started needing `AUTH_SECRET` in every environment — but the integration config never set
  one. It passed locally because the config calls `loadLocalEnv()`, which reads `.env.local`,
  and CI has no such file. The full gate was green on my machine and red on the runner, for
  the same commit.
- **Fix**: a fixed `AUTH_SECRET` literal in `vitest.integration.config.ts`, beside the
  provider knobs that are there for exactly the same reason. Verified by reproducing the
  runner's conditions rather than trusting the change — database present, `.env.local` moved
  aside — which failed before and passes after.
- **Lesson**: this is the third variant of one bug. An environment is code, configuration and
  data, and those three arrive from different places; a file sitting on one developer's disk
  is configuration the runner does not have. The rule that keeps falling out is that **a test
  suite should carry its own configuration**, so the answer to "does this pass?" does not
  depend on whose machine is asking.

### The drift check found a drift that was already in production

- **Issue**: the first deploy after the build-time migration check shipped failed, naming
  `0003_clear_wasp` as missing from production. That was the check working — but the table it
  named had been absent for **two prior deploys**. Migration 0003 landed in one pull request
  and the `recordUsage` call sites in the next, both deploying before the check existed. So
  production had been running four inserts per request against a table that did not exist, on
  the chat, upload and retry paths, and had recorded no usage at all.

  Nothing reported it, by design. `recordUsage` catches everything and returns
  `{ recorded: false }`, because it runs on the chat path and the quality bar forbids logging
  anything that could carry message content. The catch is correct: a metering failure must not
  break someone's answer. What was missing is that the failure had no _other_ way out.
  Returning a boolean nobody reads is indistinguishable from swallowing the exception.

- **Fix**: applied the migration to production, which unblocked the deploy. The real fix is
  consuming the signal that already exists —
  [`decisions/014-usage-limiting.md`](decisions/014-usage-limiting.md) had already written down
  that `recordUsage` reports whether it recorded and that nothing reads it, filed as a
  consequence rather than a bug. It reads as a bug now. _Since done_: the usage dashboard's
  `lastRecordedAt` consumes it (`lib/usage/dashboard.ts`).

- **Lesson**: two, and the second is the one I would not have predicted.

  A silent catch has to be silent about the _error_, not about _failing_. Those are separable,
  and conflating them is what turned a missing table into an invisible one. This mattered more
  than it looks: the next slice enforces caps by querying that same table, and those query
  helpers have no catch. The identical drift would have surfaced as 500s on every chat request
  instead of as nothing — the same fault, three orders of magnitude louder, depending only on
  which function happened to touch the table first.

  And: **a guard that ships after the code it guards begins by finding a failure rather than
  preventing one.** The check was written to stop a repeat of an earlier incident, and its
  first act was to discover a live instance nobody knew about. The ordering was the mistake —
  had it landed with or before the migration it protects, production would never have drifted.
  The instinct to build the guard "before it is needed" was already too late; it was needed
  two pull requests earlier.

### A seed script that read one database and wrote to another

- **Issue**: the demo document vanished from production, and re-seeding would not restore it.
  `DATABASE_URL_UNPOOLED=<production> pnpm db:seed` reported `Seeding <the production endpoint>`, then
  `Demo workspace already present`, then `already has 1 document(s) — leaving them alone`, and
  exited 0. Production had **zero** documents.

  The script talks to Postgres through two paths. Its own client is built from
  `DATABASE_URL_UNPOOLED ?? DATABASE_URL`; the query helpers it imports from `lib/` use the
  singleton in `lib/db/index.ts`, which reads **`DATABASE_URL` and nothing else**. Exporting
  only the unpooled variable therefore pointed the workspace lookup at production and
  `listDocuments` at whatever `.env.local` held — the development branch, which did still have
  the document. The script asked one database a question about another's data.

- **Fix**: `process.env.DATABASE_URL = connectionString`, assigned before the dynamic imports so
  the singleton is constructed against the same target. The imports were already dynamic, for a
  neighboring reason, which is what made the fix a single line.

- **Lesson**: three.

  **Every line of that output was true.** The host was production, the workspace id was
  production's, the document count was a real count of real rows. Only the conclusion joining
  them was false. That is the hardest class of diagnostic to distrust, because careful reading
  confirms it — and it cost a redeploy and a connection-string change, both aimed at the wrong
  thing, before anyone doubted the script instead of the configuration.

  **A script that reuses application modules inherits their configuration, not its own.** The
  existing guard here checks that the _embedder_ was chosen deliberately, because that had gone
  wrong before. It could not see this, because the provider was correct — the divergence was in
  a variable the script never compared against itself. Any script resolving a connection
  differently from the app it imports has two databases and no way to notice.

  **What ended it was a second opinion, not more reasoning.** A throwaway script that opened
  only the URL it was handed and printed what was actually in the workspace settled in one run
  what two rounds of hypotheses had not. When two components disagree about state, the fastest
  move is a third that reads it directly.

### A 404 page that returned 200, and the boundary that caused it

- **Issue**: the workspace route answered "Workspace not available" for an id the caller may
  not see — correct words, and an HTTP **200**. It rendered the message as ordinary page
  content rather than raising a not-found, so every unreachable workspace was a _soft 404_:
  fine to a reader, invisible to logs, and an assertion crawlers and uptime monitoring would
  take at face value.
- **Fix**: `notFound()`, with the same copy moved into a segment `not-found.tsx`. That was
  half of it. Adding an app-wide `not-found.tsx` at the same time exposed that there had
  never been one — an unrecognized URL anywhere in the product fell through to Next's own
  unstyled page, which is the one screen that would look like a different product.
- **Lesson**: two, and the second was measured rather than reasoned.

  A page that _describes_ a failure is not the same as a response that _reports_ one. The
  visible layer was right, which is exactly why nobody looked: every human check passes, and
  the thing that is wrong is only observable to a machine.

  Then the fix did not work, and the reason is a Next behavior worth knowing. `notFound()`
  still returned 200 — because that segment has a `loading.tsx`, and **a Suspense boundary
  lets the framework flush the shell before the page has decided anything.** Once bytes are
  on the wire the status is committed, so a later `notFound()` can change the body and not the
  status line. Confirmed by removing `loading.tsx` and re-probing: a real 404. Restored,
  because a skeleton on a database-backed route is worth more than a status code on a page no
  crawler can reach — but the tradeoff is now a choice rather than an accident, and the test
  asserts what is actually true instead of what ought to be.

  The general shape: **streaming makes response metadata a race against rendering.** Anything
  that has to be in the headers — status, redirects, `Set-Cookie` — has to be decided before
  the first flush, and a Suspense boundary moves that moment earlier than it looks.

  Worth noting what it cost to find: the guard that produced this failure is a good one — it
  refuses to fall back to storing addresses in the clear. A version that degraded quietly
  would have shipped, and production would have recorded raw IP addresses while every test
  stayed green.

### The accessibility pass, and a test that could not have failed

- **Issue**: three things, in the order they were found.

  `@axe-core/playwright` across six surfaces reported exactly one violation, and it was real:
  `scrollable-region-focusable`, serious, on the source panel's body. A document is longer than
  the panel and that region contains no focusable children — the passage is text — so a
  keyboard-only reader could open a citation and then have nothing for arrow keys to act on.
  On the product's headline feature.

  Second, the regression test written to cover the invisible-chip bug **could not have failed**.
  It compared the chip's background against `node.closest("[data-message-bubble]") ??
node.parentElement`, and no such attribute existed — so it fell back to a transparent inline
  element and passed without ever looking at the bubble.

  Third, Streamdown renders `**bold**` as `<span class="font-semibold">`. Visually correct,
  semantically empty, and not something axe can report: from the outside a weighted span is
  indistinguishable from decorative styling.

- **Fix**: `role="region"` with an accessible name and `tabIndex={0}` on the scrollable body —
  a name rather than a bare tab stop, since focus landing somewhere unannounced trades one
  problem for another. A real `data-message-bubble` marker on the message bubble, with the
  fallback **removed** so a missing marker throws instead of silently passing. And `strong` and
  `em` overrides beside the existing `img` and `a` ones.

- **Lesson**: the automated pass is a floor, and this run measured how low.

  Reintroducing the original invisible chip — `bg-muted` on a `bg-muted` bubble — turns the
  suite red on **one** test. **All six axe scans stay green.** That is the claim demonstrated
  rather than asserted: contrast rules compare text to its own background, and
  `text-muted-foreground` on `bg-muted` is a compliant, designed pair. Nothing automated
  measures whether a control announces itself as one.

  The second finding is the more uncomfortable one, because it is the same mistake this file
  already records from Milestone 1 — a test whose expected value coincides with what a broken
  implementation produces. Knowing the failure mode did not prevent repeating it. What caught it
  was asking "what would make this fail?" and checking the selector actually matched, which is a
  cheap habit and evidently not an automatic one. **A test defending a specific regression
  should be run against that regression at least once**; it takes a minute and it is the only
  thing that distinguishes a guard from a decoration.

### Five interface faults that only using the product could find

All five came from Lucian navigating the app after the account page and navigation landed. Every
automated gate was green: 389 unit tests, 97 integration, 49 end-to-end, axe clean on six
surfaces. None of these is the kind of thing a test suite is shaped to notice.

- **Issue 1 — no navigation link showed which page you were on.** Every destination looked
  identical whichever one you were reading.
- **Issue 2 — navigation felt broken.** Clicking a link left the previous page on screen while
  the server worked, with nothing acknowledging the click. The reflex is to click again.
- **Issue 3 — "Delete account" did not look like a button.** It read as a link and only became
  a button on hover.
- **Issue 4 — one link, two meanings.** `/w` is polymorphic: it resolves a signed-in user to
  their personal workspace and a guest to the shared demo. Labeling it "Workspace" for a guest
  described somewhere they could not go.
- **Issue 5 — the link stayed marked in the wrong place.** For a signed-in reader, `/w` matched
  every workspace including the demo, so the nav claimed "Workspace" was current while the page
  itself was headed "CiteSeek Demo" and badged read-only.

- **Fix**: `aria-current="page"` plus weight and underline; `loading.tsx` boundaries on every
  page route; `variant="destructive"` instead of `ghost`; a label chosen from the actor type;
  and an `excludes` prop so the workspace link is unmarked while reading a workspace that is not
  the reader's own.

- **Lesson**: four, and the second is the one that changed a design.

  **Three of the five are affordance faults, and this codebase now has a pattern of them.** The
  citation chip drawn in the color of the bubble behind it, the ghost delete button visible only
  on hover, and the unmarked navigation are the same defect: a control that is present, labeled,
  operable, and does not announce itself. Automated checks assert existence and behavior. Nobody
  has written the check that asserts a thing _looks like what it is_, because there isn't one.
  The pattern is strong enough now to be a review question rather than an accident: **for every
  new control, does it read as a control without hovering it?**

  **The instinct was better than mine, and measuring proved it.** The first fix for the slow
  navigation was a spinner beside each link, using `useLinkStatus`. Lucian asked whether it would
  be better to navigate instantly and show a loader on the destination — which is exactly what
  `loading.tsx` does, and it is both faster to perceive and more informative, because a skeleton
  reserves the real layout and says _where_ you are going. Measuring then showed the spinner was
  worse than redundant: on a deliberately slowed server it fires for a page with no boundary, but
  **never for `/w` or `/demo`**, because those are redirect-only route handlers rather than
  client-side transitions. The one link he had actually named — "Try the demo" — was the one case
  the spinner could not help. The wrapper came out of ten files.

  **A polymorphic route needs a label chosen at the call site.** `/w` deciding where to send you
  is good design — no other route has to know a workspace id in advance — but a single fixed
  label cannot describe a destination that changes per caller. The interface has to carry the
  polymorphism the route hides.

  **The alternative fix was more UI, and the cheaper one was more precision.** Both proposals for
  issues 4 and 5 were structural: a second "Demo" tab, then a workspace switcher in a sub-header.
  Each would have added permanent chrome for a set of one real workspace plus a read-only fixture
  — the multi-workspace UI that `decisions/016-workspace-membership-deferred.md` had deferred one
  commit earlier. A dynamic label and an exclusion prop resolved both without a new surface. When
  a nav feels wrong, the first question is whether it is _lying_ rather than whether it is
  missing something.

### A test suite that exhausted its own rate limit

- **Issue**: six end-to-end specs began failing on the citation chip and on the refusal path,
  immediately after a change that touched neither. The captured page told the real story: **"The
  demo has reached today's capacity."** The development database held exactly **40** usage rows
  in the last day, which is precisely the guest daily cap. Every local guest hashes to the same
  `"local"` address sentinel, so roughly twenty runs of the suite are one caller spending one
  quota.

  `USAGE_LIMITS=off` in `playwright.config.ts` exists to prevent this — but it only applies to a
  server Playwright _starts_. `reuseExistingServer` is true locally, so a stale `pnpm start`
  left on port 3000 by anything else is attached to silently, **without the flag**, and the suite
  then fails on an unrelated-looking symptom.

- **Fix**: cleared the rows behind a host guard that refuses any database but the development
  branch, and recorded the trap in `backlog.md` with two candidate fixes — a per-run
  `x-vercel-forwarded-for` so runs stop sharing a bucket, or having the suite fail loudly when
  the server it attached to lacks the flag.

- **Lesson**: two.

  **The diagnosis was three wrong guesses deep before it was measured.** A stale server, then a
  torn build, then a missing demo document — each plausible, each wrong. What settled it was
  reading the failure's own page snapshot, which had been saying "capacity reached" from the
  first failure. Playwright writes that file on every failure and it was faster than any of the
  theories.

  **Verify the harness, not just the product.** Confirming the flag actually reached the server
  took one line — instrumenting the `webServer` command to write `process.env.USAGE_LIMITS` to a
  file — and it proved Playwright _does_ pass it, which redirected the search to
  `reuseExistingServer`. A test configuration is code; when it is the suspect, it deserves the
  same treatment as any other suspect, which here meant an experiment rather than a reading of
  the docs.

### Every button in the app lost its pointer cursor, silently

- **Issue**: reported after use — the header's sign out, both account-page buttons, both buttons
  in the delete-account dialog, send, delete document, and "Continue with GitHub" showed no
  pointer on hover. Links kept theirs, so the app was inconsistent with itself and buttons read
  as decoration.

  Not a mistake anyone made here. **Tailwind v4's Preflight sets `cursor: default` on buttons**,
  deliberately, to match the browser's own default; v3's Preflight set `cursor: pointer`. The
  upgrade removed it from every button at once, and nothing in the project had ever needed a
  cursor rule, so there was no line to notice had stopped working.

- **Fix**: one base-layer rule restoring the pointer for `button`, `[role="button"]`, `label[for]`
  and `summary`, excluding `:disabled` and `aria-disabled`. Placed in the base layer rather than
  on the `Button` component so it also covers controls this codebase does not author — Radix
  renders its own buttons for dialog and select triggers.

- **Lesson**: two.

  **This is the fourth affordance fault in the same codebase**, after the invisible citation
  chip, the ghost delete button, and the unmarked navigation. Every one of them was a control
  that existed, was labeled, was operable, and did not look like a control. No automated check
  covers this — axe considers a button with a default cursor a perfectly valid button — so the
  E2E suite now asserts computed `cursor` alongside the other things "automated checks cannot
  see", and the assertion was verified by removing the rule and watching it fail.

  **A framework upgrade can delete a behavior nobody wrote.** The dangerous changes in a major
  version are not the ones that break the build; they are the ones that silently remove a
  default, because there is no code to review, no test to fail, and no error to read. The
  pattern is the same as the false bundle claim from Milestone 3: a belief about what a
  dependency does, held without measurement, staying true right up until it wasn't.

### A link to a redirect cannot be prefetched, and cannot show a loading state

- **Issue**: reported from use — clicking "Workspace" or "Demo workspace" felt slow and gave no
  feedback, sometimes in production. Both pointed at `/w`, a **route handler that redirects**.
  That made one click two full page navigations: `/w`, which resolves the caller and answers
  307, then `/w/<id>`. Neither is a client-side transition, so the router never commits and the
  previous page stays on screen until both round trips finish.

  The `loading.tsx` boundary added earlier could not help. It renders when the router commits a
  route, and the router was never involved. Nor could a link-level pending indicator:
  `useLinkStatus` reports nothing for a navigation that is not a client-side transition — which
  had already been measured when the indicator was removed.

- **Fix**: resolve the workspace in the header and link straight to `/w/<id>`. The route handler
  stays for the case that needs it — a reader with no workspace yet, where one must be created,
  which is a write and belongs in a handler rather than a page render.

- **Lesson**: three, and the third is about the test rather than the code.

  **A redirect is invisible to the router.** Prefetching, loading boundaries and pending state
  are all built on the router knowing where a link goes. A handler that decides at request time
  defeats all three at once, and the cost is invisible locally — the round trip measured 135–174
  ms here, against 44–55 ms after. On a cold serverless function it is two cold starts back to
  back with nothing on screen, which is exactly the reported symptom.

  **The fix deleted an earlier fix.** `HeaderNavLink` had grown an `excludes` prop so that a link
  to `/w` — a prefix of _every_ workspace — would not mark itself current while the reader was in
  the shared demo. Pointing at one specific workspace makes a different one simply not match, so
  the special case and its four tests went away. Two symptoms, one cause: the link had been
  pointing at a resolver rather than a destination.

  **The verification was wrong before it was right.** The first attempt delayed every request to
  `/w/**` to simulate a cold function, and reported no loading skeleton — which looked like the
  fix had failed. It had instead delayed the _prefetch_, which is what makes the skeleton
  possible. Watching for prefetch directly showed three RSC requests for the workspace fired
  while still sitting on `/account`. **A test that suppresses the mechanism it is measuring
  reports a real number about a situation that does not exist.**

## The first answer of a session looked like the page reloading

- **Issue**: reported from local use — asking the first question in a new conversation made the
  whole page appear to re-render. Every later question in the same conversation was instant. The
  report was precise about the trigger: on send, not on typing, and only ever the first time.

- **The first diagnosis was wrong, and confidently so.** The draft question was held in
  `ChatPanel`, so every keystroke re-rendered the transcript beneath it — each `Answer`
  re-parsing its markdown through Streamdown. That is a real defect and it is fixed below, but it
  is a _per-keystroke_ cost, and the symptom being explained happened on submit. The explanation
  was reached by reading the code for something that looked expensive and stopping when one was
  found. It fit a symptom nobody had reported.

- **Measurement, against a production build and then against the dev server**: three questions
  asked in sequence on one page, timing each from click to rendered citation and recording every
  JavaScript chunk fetched in between.

  |                  | first send                      | second | third  |
  | ---------------- | ------------------------------- | ------ | ------ |
  | dev server       | **1433 ms**, chunks at +1006 ms | 54 ms  | 883 ms |
  | production build | 918 ms, chunk at +478 ms        | 54 ms  | 862 ms |

  The `Answer` component is behind `next/dynamic` — it carries Streamdown, 428 KB of parser,
  highlighter and diagram code deliberately kept out of the initial bundle. It was warmed on
  submit, on the reasoning that retrieval and the first token would cover the fetch. They did not:
  the chunk was still arriving halfway through the first answer, and in development, where Next
  compiles it on demand, it took a full second. `dynamic()` had no `loading` fallback, so
  throughout that second the assistant's bubble rendered `null` — appearing, collapsing to
  nothing, then filling in.

- **Fix**: three parts, only one of which was the reported bug.

  Warm the chunk at idle rather than on submit, so it is fetched while nobody is waiting for it —
  three chunk fetches during the first send became one. Give `dynamic()` a `loading` placeholder,
  so the space is reserved and the bubble cannot collapse. And move the draft question down into
  `Composer`, where it belongs: nothing above that component reads it.

- **Lesson**: three.

  **The third question took 862 ms with no chunks at all.** A single first-versus-second
  comparison had shown 962 ms against 46 ms, which looked decisive and was mostly noise. Three
  samples showed the timings are bimodal for reasons unrelated to chunks. The chunk fetch is real
  and worth fixing; "the first send is slow" was never the claim the data supported. **Two data
  points cannot distinguish a trend from variance, and the one-time cost had to be identified by
  what loaded, not by how long it took.**

  **Lifting state is a default, not a rule.** `ChatPanel` owning the draft followed the same
  pattern as every other panel here, and was wrong for a specific reason: no component above the
  form reads the draft, and the transcript below it is expensive to re-render. Asserted now as a
  render count rather than a duration — a timing assertion would be flaky on a loaded machine,
  and the render count is the thing that regressed. Verified by reinstating the lifted state:
  **20 transcript renders for 19 keystrokes, against 1 after.**

  **A code splitting decision is not finished when the bundle shrinks.** The split was measured
  and reported at the time as costing nothing visible. What was measured was the initial payload;
  what was never measured was the first render that needs the split-out chunk.

## Deleting a conversation asked for no confirmation

- **Issue**: reported from local use. The delete control sits beside rename in a dense list, both
  icon-only and adjacent, and deletion is permanent and immediate.

- **Fix**: an `AlertDialog`, naming the conversation and its message count.

- **Lesson**: the confirmation is deliberately lighter than the account one, which requires
  typing a word. What is lost here is one conversation, not an account, and a typed confirmation
  on every row of a list trains the reader to type through it. **The dialog's job is not to add
  friction but to say which conversation is about to go** — that is the part a misclick got
  wrong. The documents list has the same shape of control and no confirmation; that inconsistency
  is filed in the backlog rather than fixed in passing.

## The conversation list did not know a turn had happened

- **Issue**: reported from local use — the message count beside a conversation stayed at its old
  value until the page was reloaded. The same gap hid a second symptom nobody had reported yet:
  the title generated from a first question did not appear either, because it is written by the
  same request.

- **Cause**: the list is server-rendered from the database, which is the right call — one source
  of truth, no client-side copy to drift. What was missing is the other half of that arrangement.
  `router.refresh()` was already wired to rename and delete, both of which are initiated _by_ the
  list. A turn is initiated by the composer, and nothing connected the two.

- **Fix**: `useChat`'s `onFinish` calls back to `WorkspaceSections`, which already owns
  `refreshFromServer`. Passed only for a signed-in reader: a guest's turns are never persisted, so
  a refetch would re-render identical markup.

- **Lesson**: two.

  **The race was checked before the fix relied on it.** The route persists inside `streamText`'s
  own `onFinish`, so "the stream has closed" and "the rows are committed" are not obviously the
  same moment. If the body could close first, refreshing on completion would read a count one
  turn behind — the same stale number, arriving a second later instead of on reload, which is
  harder to notice and harder to explain. An integration test now consumes the stream and queries
  immediately, with nothing awaited in between. It passes, and it will fail loudly if the route's
  persistence ever moves into `after()`.

  **A cache is only as good as its invalidation, and this one had two of three.** Rename and
  delete refreshed because the code doing the mutating was the code displaying the data. The
  turn did not, because the mutation happened somewhere else in the tree. **When a
  server-rendered view is the single source of truth, every writer needs to know it exists — not
  just the writers that live next to it.**

## Three from one session of using the app on a phone

- **Issue 1 — the wordmark shrank to fit.** The header's links, the session email and the
  sign-out control shared one row. Below `sm` the row ran out of space and the browser resolved
  it the only way it could: the wordmark is an `<Image>`, so it scaled down rather than wrapping.
  A logo whose size depends on the length of your email address looks broken.

- **Fix**: a sheet below `sm`, holding the same destinations plus the session's exit. The exit
  had to move with them rather than be hidden — a session with no visible way out is a trap on a
  shared machine, and that is most true on the devices the sheet exists for.

- **Issue 2 — Usage was not in the navigation**, which was a deliberate call and the wrong one.
  The original reasoning holds up on its face: usage is per-workspace, and a link in a global
  header needs a destination on every route. What it missed is that the header **already
  resolves the workspace**, for an unrelated fix to a redirect. The id was in hand the whole
  time. A page reachable only from the body of the page it measures is a page nobody opens.

- **Fix**: in the header, omitted entirely when there is no workspace yet. Removed from the
  workspace body in the same change — two links to one destination is not redundancy, it is a
  second thing to keep in sync, and the E2E would have hit two matches for the same name.

- **This introduced a defect worth recording, because it was caught by writing the test rather
  than by using the app.** Each nav link decided for itself whether it was current by
  prefix-matching the pathname. That worked while no destination lived inside another.
  `/w/<id>/usage` starts with `/w/<id>`, so on the usage page **both links marked themselves as
  the current page** — invisible on screen beyond two bold items, and a screen reader announcing
  "current page" twice. Only the container knows every href, so the rule moved there: longest
  match wins. Prefix matching is still right _within_ a destination, which is what keeps
  Workspace marked while reading a conversation inside it.

- **Issue 3 — deleting the last conversation left its messages on screen.**

- **Cause**: `useChat` seeds from `initialMessages` **once per mount** and then owns its state.
  That is correct — otherwise a streaming answer would be wiped by every re-render — but it means
  a new `initialMessages` prop is ignored. Deleting the last conversation refreshed the server
  data, handed the panel an empty list, and changed nothing.

- **Fix**: `key={activeChatId ?? "none"}`, so the conversation is the component's identity and a
  different conversation is a different component.

- **Lesson**: two.

  **The reported bug was the harmless half.** Deleting the last conversation leaves a stale
  transcript with nothing behind it — visibly wrong, and nobody is misled. The same cause meant
  **switching between conversations would show the previous one's messages**, which is a
  transcript attributed to the wrong conversation. Nobody had reported it. Fixing the reported
  symptom without asking what else shared the cause would have left it.

  **The mock had to be made faithful before the test could fail.** The existing `useChat` stub
  returned a fixed empty array, so neither case could be expressed. Returning `options.messages`
  directly would have been worse: the mock would follow the prop on every render, and the test
  would pass with or without the fix. It now holds the seed in `useState`, mirroring what the
  real hook does — and both tests fail without the key, which is the only reason to trust them.

## The seed was idempotent toward the wrong thing

- **Issue**: found while converting the demo document to a PDF, before it could bite.
  `seedFixtureDocument` returned early whenever the demo workspace held **any** document. That is
  idempotent in the sense CI checks — run it twice, nothing changes — and it also guaranteed that
  no already-seeded database would ever pick up a change to the fixture. Switching the handbook
  to a PDF would have been a no-op on every environment that mattered, production included, and
  the seed would have printed a success line while doing nothing.

- **Fix**: key the decision on the filename. The fixture is present and the run is a no-op; a
  superseded version is present and gets replaced; neither is present and it gets created.
  Anything else in the workspace is left alone, because this owns one document rather than the
  workspace. The decision moved into a pure function so it could be tested without a database —
  six cases, including "both filenames present", which is what a half-finished run leaves behind.

- **Lesson**: **idempotence is not convergence.** "Running twice changes nothing" is satisfied
  perfectly by a script that does nothing at all. What a seed actually has to promise is that the
  database ends in the intended state, whatever state it started in. The check that made it
  idempotent was the check that stopped it converging, and the two read identically at the call
  site.

## A PDF parser emptied the array it was given

- **Issue**: a new integration test ingested the committed demo PDF twice — once to assert page
  numbers, once to assert the text. The second failed with **"This PDF could not be read. It may
  be corrupt or password-protected"**, about a file the first call had just read successfully.

- **Cause**: PDF.js takes ownership of the typed array it is handed and detaches it. Measured on
  the fixture: **68,066 bytes before the call, 0 after.** The second call is not reading a
  different file, it is reading nothing.

- **Fix**: read a fresh copy per ingestion in the test.

- **Lesson**: **the codebase already said so.** `extract.ts` carries a comment written a
  milestone earlier stating exactly this, ending "documented because the failure it would cause is
  silent". The test was written against the function's name rather than its documentation. The
  comment was also slightly optimistic — it predicted a later read would see an empty buffer,
  where PDF.js in fact throws a message that blames the file — so it now records the measured
  numbers and the wording of the error, which is what someone hitting this will search for.

## A performance regression that did not exist

- **Issue**: dark mode landed, Lighthouse was re-run on the landing page, and the score dropped
  from **99 to 93** with total blocking time up from **50 ms to 300 ms**. Read at face value that
  is a serious regression from a feature that was supposed to be free.

- **It was noise.** Three runs of each build, same machine, same server:

  |        | Performance | Total blocking time | Script evaluation |
  | ------ | ----------- | ------------------- | ----------------- |
  | before | 95, 95, 95  | 30, 30, 20 ms       | 189, 186, 179 ms  |
  | after  | 97, 95, 95  | 40, 20, 20 ms       | 173, 176, 180 ms  |

  Identical. The original 99 and the original 93 were both outliers of the same distribution.

- **Lesson**: **total blocking time is the noisiest number Lighthouse reports**, and it is the one
  most likely to move when you have just changed something and are looking for a reason. One run
  against one run cannot separate a change from variance — the same mistake as reading a single
  first-send timing as proof that a chunk fetch was the bottleneck. The structural claim was worth
  more than the score anyway, and it is checkable directly: the built HTML has **zero inline
  scripts in `<head>`** and no `suppressHydrationWarning`, which is the whole point of putting the
  preference in a cookie.

## A click lost between two working mechanisms

- **Issue**: the theme end-to-end tests failed intermittently — roughly one run in three, only
  under the full suite, never when the file ran alone. The assertion timed out waiting for the
  class to change.

- **The first two explanations were both wrong.** Raising the timeout to 15 s did not help.
  Suspecting `revalidatePath("/", "layout")` of slowing the suite, removing it did not help
  either — though it did confirm that failing runs took 37–40 s against 21–24 s for clean ones.

- **Cause**: the control is a server action inside a plain form, which works twice over — the
  browser posts it natively before hydration, React intercepts it after. A click landing _during_
  hydration falls between the two and is **dropped rather than delayed**. That is exactly why a
  longer timeout could never help, and why it only appeared under load, where hydration takes
  longer.

- **Fix**: the test waits for hydration before clicking. Four consecutive clean runs after, and
  the suite got faster.

- **Lesson**: **"raise the timeout" is a hypothesis, and it should be treated as one.** A timeout
  that does not fix a flake has told you something specific — the work is not slow, it never
  started — and that is more informative than a passing run would have been. A real reader can hit
  the same window; it is narrow and the control is not on the critical path, but the test now
  documents it rather than hiding it behind a longer wait.

## A dark-mode variant that covered one of the two dark modes

- **Issue**: found while wiring the new logo, not by a failing test. The palette switches on
  either an explicit `.dark` class or `prefers-color-scheme`, but the Tailwind variant was written
  as `@custom-variant dark (&:is(.dark *))` — **class only**.

- **Why that matters more than it looks**: the palette itself is CSS variables, so a system-dark
  reader did get dark colors. What they did not get was any `dark:` utility, and shadcn's
  components are full of them — `dark:border-input`, `dark:bg-input/30`, `dark:hover:bg-muted/50`,
  `dark:aria-invalid:ring-destructive/40`. Light-mode component styling over a dark background, on
  the path most readers arrive by, and invisible to every test in the suite because they all set
  the cookie.

- **Fix**: the block form of `@custom-variant`, emitting both the class selector and the media
  query, with `@slot` for the utility's declarations. Guarded by a test that reads `globals.css`
  and asserts both branches are present, and by an end-to-end test comparing the two paths.

- **Lesson**: two.

  **A feature with two entry points needs both tested, and the cheap one is the one you skip.**
  The cookie path was tested from the first commit because it is the one with a button. The system
  path had no UI, so nothing exercised it — and it is the default for everyone who never touches
  the toggle.

  **The first version of that comparison test reported a difference that did not exist.** It
  compared "the first link matching /demo/i" across the two paths — but the header renders
  differently for a visitor with a session than for one without, so it measured a nav link against
  a landing-page button and reported `0.1` against `0.15`. The fix was to probe an element
  guaranteed identical on both paths. **A comparison test is only as good as its claim that the
  two things being compared are the same thing**, and that claim deserves the same scrutiny as the
  assertion.

## The metric that could not see half of what it measured

- **Issue**: found by reading, not by the tool. After a pass that reported comment density down to
  21.5%, `components/site-header.tsx` still carried an 18-line block justifying two class names and
  a 19-line block explaining one ternary. The number said the work was done; the file said it was
  not.

- **Cause**: the script counted a line as a comment when it started with `/*`, `*` or `//`. A JSX
  comment starts with `{/*`, and the prose inside it is indented plain text with no leading `*`.
  So **every JSX comment in the codebase was counted as code** — both missing from the numerator
  and inflating the denominator. In components, which is where the longest blocks were, the
  measurement was blind to precisely the comments being audited.

- **Fix**: track block state properly — open on `{/*` or `/*`, close on `*/`, count everything
  between. The corrected figure for the same tree was **23.4%**, not 21.5%. Every intermediate
  number reported during that pass was understated.

- **Lesson**: two.

  **A measurement that only ever moves in the direction you want is not yet evidence.** The number
  fell steadily through the pass and each drop read as progress, which is exactly when nobody
  re-derives it. It took a human opening a file and seeing an essay to expose it.

  **When a tool and a reading of the source disagree, the source wins and the tool is the defect.**
  The instinct is to explain the discrepancy — this file is small, percentages are noisy. The
  useful move is to assume the instrument is wrong and go check it.

## Screenshots the test fakes were not allowed to take

- **Issue**: the README needed four screenshots, and the obvious way to produce them was the
  setup the E2E suite already uses — a local production build with `CHAT_PROVIDER=fake` and
  `EMBEDDINGS_PROVIDER=fake`. Deterministic, offline, no quota spent. It would have produced
  images that lie.

- **Why**: the fake embedder is a hashing bag-of-words vectorizer. That is the right shape for
  its actual job — it proves the pipeline stores, retrieves and orders — but it is not semantic,
  and nothing in the suite depends on it being semantic. Asking the seeded handbook _"do I have
  to keep receipts for expenses?"_ under the fake retrieves the **laptop-encryption** passage.
  The answer streams, the chip renders, the panel opens on a highlighted passage, and every
  assertion in the E2E suite passes — because each one checks that a citation _resolves_, not
  that it is _right_.

  A screenshot has no assertions at all. It shows a reader the chip and the passage side by
  side, which is precisely the thing the fake gets wrong, on the one claim the whole project is
  built on.

- **Fix**: shoot the deployed app. Real embeddings, real model, a guest session on the public
  demo. The cost is output that is not byte-reproducible and a little quota per run, both
  recorded in the script's header so the next person does not "fix" it back.

- **Lesson**: **a fake is scoped to the assertions written against it, and an image asserts
  nothing.** Every existing use of this embedder is sound; the same fake became dishonest the
  moment the output was a picture instead of a boolean. Before reusing a test double in a new
  context, ask what it is allowed to be wrong about — and whether the new consumer is checking
  that.

## A link that started a session for everyone who looked at it

- **Issue**: reported from the outside as a rendering glitch — click the wordmark on the landing
  page and the calls to action change from "Get started" to "Continue in the demo", but the
  header keeps showing no navigation until you visit another page or reload.

- **Cause, which is not a rendering bug at all.** `/demo` is a `GET` route handler that sets a
  guest cookie, and Next prefetches `<Link>` targets as they enter the viewport. So loading the
  landing page _ran the handler_, and every visitor was handed a guest session without touching
  anything. Measured rather than reasoned: `/privacy` (no demo link) minted no cookie, `/` minted
  `citeseek.guest`, and `/` with JavaScript disabled minted none.

  The two-part symptom then follows exactly. The cookie arrives with the same response that
  rendered the page, so that render is still anonymous. The next request has the cookie, and the
  route segment re-renders as a guest — while the **header lives in a layout**, which a
  same-layout navigation reuses rather than re-renders. Page updated, header did not.

- **Worse next door**: `/w` is the same shape and calls `getOrCreatePersonalWorkspace`. A
  prefetched link to it creates a workspace.

- **Fix**: `prefetchFor()` in `lib/links.ts`, one list of the GET routes that write, applied at
  every link to them. A list rather than seven scattered `prefetch={false}` props, because the
  failure is silent and the next link is easy to add without one. An E2E test asserts that
  loading the landing page leaves no session cookie.

- **Then it took a test down with it, which is the more interesting half.** Disabling those
  prefetches broke `a choice applies immediately and survives navigation`. The theme control is a
  form posting to a server action, and a click landing before hydration is **dropped, not
  delayed**. The suite's guard against that was `waitForLoadState("networkidle")` — and it had
  only ever worked because the prefetch traffic happened to keep the network busy until
  hydration finished. Removing the prefetches removed a guard nobody knew was load-bearing. It
  now waits for React's own `__reactFiber$` key on the button, which is the actual signal; the
  suite is also ~10s faster for not waiting on idle network.

- **Lesson**: three.

  **A `GET` that writes will eventually be called by something that never clicked.** Prefetchers,
  crawlers, tab restore, link previews. This is the third instance in this project — `/c/new` was
  a link until the same defect made it a form POST — which is why the rule is now a list in code
  rather than a habit.

  **A user-visible symptom can be two bugs deep.** "The header does not update" is true, and
  fixing the header would have left every visitor still collecting a session cookie from a page
  they only read.

  **A test can pass for a reason unrelated to what it asserts.** `networkidle` never checked
  hydration; it correlated with it. Correlation held until an unrelated change removed the
  traffic, and then a real assertion started failing for a reason that had nothing to do with the
  thing it tests.

## A space that existed in the source and not on the page

- **Issue**: reported by reading the deployed privacy policy, which said CiteSeek stores the text
  "extractedfrom documents you upload". The source had a perfectly ordinary space:
  `<strong>text extracted</strong> from documents you`.

- **Not a typo, and not stale output.** Checked the bytes — a plain `0x20`, no non-breaking
  space, no zero-width character. Checked the build was current by confirming an unrelated change
  from the same branch appeared in the served HTML. The React payload itself showed the space
  already gone: `"stores the "`, the `strong` element, then `"from documents..."`.

  The same construct on `/about` — `<em>is</em> right,` — renders its space correctly. I could
  not explain the difference from inspection, and stopped trying rather than invent a reason.

- **Fix**: restructure so no whitespace sits at the tag boundary — the emphasis now ends the
  clause and is followed by a comma. The first attempt, an explicit `{" "}`, **was silently
  reverted by Prettier**, which collapses it back into the plain space that gets dropped. So the
  obvious fix is not just fragile, it does not survive `pnpm format`.

- **Lesson**: two.

  **Whitespace in JSX is not a character you typed, it is an output of a transform.** Anywhere a
  space sits between an inline tag and a word, it is a value being computed rather than stored,
  and it can be computed to nothing. Phrasing that keeps punctuation at the boundary has no such
  dependency.

  **A formatter can revert a fix.** The `{" "}` looked right, passed review by eye, and was gone
  by the time the file was saved. Any fix that consists of formatting-significant whitespace has
  to be re-read _after_ the formatter has run, not before.

## The third database mix-up, and why the guard from the second one missed it

- **Issue**: `pnpm db:seed`, aimed at production, ran against the development branch and reported
  complete success. The deployed demo went on serving the old fixture through a redeploy while
  every line of the seed's output said it had worked.

- **Cause, in two halves.** `.env.local` supplies `DATABASE_URL` to any shell that did not
  **export** one, so a terminal where the production URL was set rather than exported quietly got
  the development one.

  The half that made it invisible: **Neon branches are copy-on-write clones.** The dev branch was
  created from production, so it carries the same workspace id, the same document ids, the same
  row counts. Every identifier the script printed was correct against either database. There was
  no wrong-looking value in the output to notice.

  **The hostname is the only field that distinguishes them** — and it is the one nobody reads.
  The script did print it.

- **Why the existing guard did not help.** `assertEmbedderWasChosen` refuses to seed a remote
  database with the fake embedder. That is the _previous_ incident in this family, and the guard
  is shaped exactly like it: it checks which embedder, never which database. The next bug in the
  same family walked straight past it.

- **Fix**: none yet in code — recorded in `docs/backlog.md` as a host guard in the same shape as
  the embedder one. The seed already resolves and prints the host, so refusing an unconfirmed one
  is cheap.

- **Lesson**: three occurrences make this the project's most repeated defect, and each had a
  different mechanism — an env var read by two clients, a pooled/unpooled split, and now an
  unexported variable against an identical clone.

  **A guard is shaped like the bug that produced it.** Writing one closes that instance, and it
  is tempting to treat the class as handled. The useful question after fixing any near-miss is
  what _else_ could produce the same outcome, because the next occurrence will arrive by a route
  the guard does not inspect.

  **Printing a value is not checking it.** The distinguishing field was on screen every single
  run. Output a human is expected to compare is not a control; a control refuses.

## A guarantee that passed its test and failed in production

- **Issue**: the relevance floor — the mechanism behind this project's headline claim — was
  admitting every ungrounded question on the deployed app. Measured with the new harness
  (`pnpm eval:retrieval`, ADR 020): at the shipped `MAX_DISTANCE = 0.6`, **10 of 10**
  unanswerable questions cleared it. Against the demo's own handbook, _"Who won the world cup in
  1998?"_ scores 0.532 — so production would have answered it, citing a remote-work policy.

- **Why every test said otherwise.** `e2e/chat.spec.ts` asserts exactly this: ask something the
  documents cannot answer, get a refusal citing nothing. It passes, and always did. It runs the
  **fake embedder**, whose distances live in an unrelated numeric range and are compared against
  a different threshold (`0.88`). The test proves the refusal _path_ works — the branch, the
  copy, the absent chips — and says nothing about whether the branch is ever taken.

  The threshold for the real model was never tested by anything, and the code said so:
  _"Provisional — needs tuning against real documents, which is the one thing no test here can
  do for us."_ That sentence was accurate and was read as a to-do rather than as an open hole.

- **Fix**: `0.6` → `0.40`, measured rather than guessed. The deeper finding is that no threshold
  is correct: the closest-chunk distances for answerable questions (0.284–0.411) **overlap**
  those for unanswerable ones (0.332–0.494), so every value trades false refusals against false
  accepts. `0.40` is the least bad point on this corpus, and the demo separates cleanly at it.

- **Lesson**: two.

  **A fake can prove a mechanism and hide the parameter that makes it work.** The refusal branch
  and the threshold that selects it are different things, and the suite covered one while the
  README described the other. Whenever a test double replaces the thing a number was calibrated
  against, that number has no coverage — however green the suite is.

  **"Provisional" in a comment is not a test.** The uncertainty was documented honestly at the
  point of decision and then behaved exactly like a resolved question for four milestones,
  because nothing failed. A known unknown needs something that fails, or it is just a note.

## The documented way to migrate production migrated development instead

- **Issue**: the README's production runbook read
  `DATABASE_URL='<production-url>' pnpm db:migrate`. Every `db:*` entry point —
  `drizzle.config.ts`, `check-migrations.mts`, `seed.mts` — resolves its connection as
  `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, and `.env.local` sets **both**, pointing at
  development. Overriding only the second one leaves the first in place, so the documented
  command connects to development, applies nothing, and exits 0.

- **Why nothing caught it.** There is nothing to catch. The fallback resolves to a valid
  connection string; a valid string is not an error. `db:migrate` has no equivalent of the
  seed's host confirmation, because that guard was written for the seed's incident and is
  shaped like it. And the failure is silent in the specific way this project keeps
  rediscovering: Neon branches are copy-on-write clones, so the wrong database returns
  right-looking output.

- **Found by asking, not by testing.** The question was "the README says `DATABASE_URL`, is
  that wrong?" — nobody had run the command against production yet, so the defect had no
  symptom to notice. The runbook had been wrong since the section was written.

- **Fix**: both recipes now set `DATABASE_URL_UNPOOLED`, with `pnpm db:check` first as the
  read-only pre-flight that prints the host it is about to change. The README also now says
  _why_ schema changes take the unpooled endpoint — the pooled one is PgBouncer in transaction
  mode, and DDL wants a session that outlives a statement.

- **Lesson**: **a `??` fallback is a chain, and overriding it means overriding the link that is
  read, not the one you remember the name of.** The fallback exists so a machine without the
  preferred variable still works — and that same property lets a machine _with_ it ignore what
  you typed on the command line.

  The wider one: **documentation is not covered by anything.** Tests, types and lint all read
  the code; a runbook is prose that produces side effects on production infrastructure, and the
  only thing checking it is whoever runs it. That makes a runbook the one place where being
  approximately right is indistinguishable from being wrong, and it should be treated as code
  under review rather than as commentary around it.

## Turning a paragraph into a button silently switched off its truncation

- **Issue**: making the document filename openable replaced
  `<p className="truncate">` with `<button className="truncate">`, keeping the class. On a
  phone the filename ran out from under the status badge and past the card's edge. Reported
  from a real device at 375px, where the name simply left the box.

- **Cause**: `truncate` is `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`,
  and all three need an element whose width is constrained by something other than its text.
  A `<p>` is block-level, so it fills the `min-w-0 flex-1` parent and truncates. A `<button>`
  is `inline-block`, so it sizes to `max-content` and the parent's constraint never reaches it.
  The class was still there, still valid, and did nothing. Fixed with `block w-full`.

- **Why nothing caught it.** Every layer was blind to it for a different reason, which is the
  part worth keeping. jsdom has no layout engine, so a unit test asserting the class is present
  passes on markup that overflows. axe has no opinion on text escaping its container. And the
  E2E suite runs at a desktop viewport, which is wide enough that a 38-character filename fits —
  the defect existed at every width below about 500px and at none above it.

- **Fix**: the CSS change, plus a Playwright test at 375px that compares bounding boxes — the
  filename's right edge against the badge's left edge and the row's right edge. An assertion
  about geometry rather than about classes, because the class was never the thing that was
  wrong.

- **Lesson**: **changing an element's tag changes its formatting context, and the classes on it
  do not announce that they stopped working.** Swapping `p` for `button`, `div` for `span`, or
  `a` for `button` is not a semantic-only edit; display, default margins, and how the parent's
  width reaches the child all move with it.

  The wider one: **a viewport is a test input.** This suite parameterizes over light and dark
  themes because a palette bug was invisible in one of them, and the same reasoning applies to
  width — it just had not been applied. One narrow-viewport case now exists; the honest reading
  is that it should have existed before there was a bug to justify it.

## A user-research finding that was half observation and half invention

- **Issue**: the write-up of the first cold-reader session recorded that the reader "ignored the
  suggested questions on screen," and drew a conclusion from it — that a canned question reads
  as a demo while the document reads as the real thing. **There are no suggested questions on
  that screen.** The empty chat state renders two sentences and a composer. There are no
  example questions anywhere in the app — the refusal (ADR 017) lists document _filenames_ and
  advises reusing the document's own wording, which is a different thing.

- **How it happened.** The observed part was real: she clicked the document, repeatedly, and
  nothing happened. The explanation was reconstructed afterward from what the app _ought_ to
  have offered a first-time reader, and written in the same voice as the observation. Nothing in
  the sentence marked which half came from watching and which from assuming.

- **Why nothing caught it.** Nothing checks prose. It went into `docs/backlog.md`, was reviewed
  as part of a diff whose subject was a UI change, and merged. It was caught later by someone
  asking "are you sure? where are they?" — which is the only mechanism that was ever going to
  catch it.

- **Fix**: the paragraph now records what the screen actually offered, which makes the finding
  stronger rather than weaker — she had nothing to work from at all, so clicking the document
  was the only move available. Two items were added to the open list that the invented
  explanation had implicitly closed: showing examples in the empty state, and the fact that
  the empty state says "your documents" on a shared demo where they are not yours.

- **Lesson**: **an invented explanation is worse than no explanation, because it closes the
  question.** Written as fact, it retired "should the empty state suggest questions?" — a live
  design decision — by implying it had been tried and had failed. A gap left open gets filled;
  a gap filled with a plausible story does not.

  The practical rule: when writing up what a user did, the observation and the interpretation
  need to be visibly different sentences. "She clicked the document three times" is evidence.
  "Because the suggestions read as canned" is a hypothesis, and it has to be labeled as one or
  verified against the screen she was actually looking at.

- **Postscript: the correction contained the same defect.** The first fix asserted that the
  refusal "already builds" example questions — it does not; it lists filenames. Written while
  fixing a fabricated claim about the same screen, without opening the component either time.
  The reflex on being caught is to write the correction immediately, and speed is exactly what
  produced the original error. **A correction is a claim and earns no discount**; it wants the
  same check as the thing it replaces, and being sure enough to feel embarrassed is not
  evidence. Both errors would have been caught by opening one file for ten seconds — which is
  also what changed the backlog item, since "move the copy that already exists" and "author
  content that does not" are different pieces of work.

## An audit that read the code and not the reasoning

- **Issue**: an automated repository audit produced a well-structured report whose
  **highest-priority recommendation was to add an MIT or Apache license**. This repository has no
  license file on purpose — that is all rights reserved, and it is a standing commercial decision
  written down before any code existed. MIT would let anyone take a project its author is weighing
  commercializing and sell it. The README has carried a `## License` section saying so since the
  week before the audit ran.

- **Why it was persuasive.** Everything around the recommendation was correct. It read the ESLint
  config and noticed `any` is banned. It read the CI workflow and described the integration job's
  Postgres service and double seed accurately. It quoted real latency numbers from the README. A
  reader with no context would have had no reason to doubt the one item that mattered.

- **It had been told, in a file it quoted.** `docs/strategy-plan.md` — tracked, public, in the
  repository — says: _"This repository is public but carries no license file, which means all
  rights are reserved. Read it, learn from it, link to it; it is not licensed for reuse."_ The
  audit **cited that same file five times** for the roadmap and milestones, then recommended MIT.

  So this is not a report that lacked context. It read the document containing the answer and
  produced the opposite of it, because "add a LICENSE" is what a repository audit says. The
  finding came from the template, not from the repository, and the accurate citations around it
  were what made it look earned.

- **Four checkable claims were also wrong**, and checking them took one command each: that no
  coverage metric is enforced (`vitest.config.ts` enforces 90% on `lib/rag` and `lib/ai`), that
  the deployment uses Edge Functions (they are Node; `vercel.json` pins a region, not a runtime),
  that UI text "likely goes through i18n" (there is none), and that the E2E suite needs an email
  auth setup (there is no email auth). The tell was in the prose: _"not shown in code, but per
  docs"_, _"the `vercel.json` likely pins…"_, _"Vitest likely collects it"_. Hedged verbs marking
  the places it did not look.

- **Fix**: one recommendation was kept — Dependabot, genuinely absent and genuinely useful. Two
  were rejected as actively harmful: the license, and `CONTRIBUTING.md` with issue templates,
  which invites contributions to unlicensed code and creates exactly the ownership ambiguity the
  licensing decision exists to avoid. The rest were already done or stale.

- **Lesson**: **citing a document is not reading it.** The failure was not missing context — the
  context was quoted five times. It was a stock recommendation, emitted because most repositories
  need one, wrapped in enough real detail to look derived from this one. The correct findings
  around it lent it their credibility.

  Two things follow. The recommendation to check hardest is the one marked **highest priority**,
  because it is the one someone acts on without reading further. And the filter that catches this
  class: for each recommendation ask _what would have to be true of this project for this to be
  right?_, then go and check. "Add a license" is right for a library seeking adoption and wrong
  for a product keeping its options open — nothing in the code distinguishes them, one sentence
  in `docs/strategy-plan.md` does, and it was there the whole time.

## A deletion promise the schema could not keep

- **Issue**: the privacy page states that deleting an account removes "the account, its workspaces,
  every document in them, every conversation, and **every usage record**." It did not remove usage
  records. `lib/users/deletion.ts` deleted one row and relied on `ON DELETE CASCADE` for the
  rest — and no cascade reaches `usage_events`, because `actor_id` is `text`, not a foreign key. It
  has to be: the same column holds guest ids, which point at no user at all.

- **Found in production data, not by reading.** A usage report run for an unrelated question showed
  two signed-in accounts, one of them an opaque UUID with no matching row: 8 requests and 11,085
  tokens still attributed to an account that had been deleted weeks earlier. The dates lined up with
  the author's own test of the deletion flow.

- **Why the code looked right.** The function carries a diagram of the cascade tree, and the tree is
  accurate — every table in it does cascade. `usage_events` simply is not in it, and nothing
  in the file suggested a table was missing. A comment that documents what a mechanism covers reads, at a
  glance, as documenting that the mechanism covers everything.

- **Fix**: an explicit scoped delete inside a transaction, plus two integration tests — one
  that the records go, one that another account's records stay, because a truncate would also
  have passed the first.

- **Lesson**: **a structural guarantee only covers what is structurally attached.** The schema was
  deliberately shaped so erasure could be one statement, and that shape is good — but it made the
  one table outside the graph invisible, because the reasoning "the cascade handles it" is not
  checkable by looking at the deleting code.

  Two things would have caught it earlier and neither existed: a test asserting the _absence_ of
  rows in every table that references an actor, and a report showing what production actually holds.
  The second is what found it, which is an argument for having such a report at all.

## Six advisories Dependabot could not fix, and the setting that moved

- **Issue**: Dependabot retried security updates for six advisories — four `postcss`, one `esbuild`,
  one `sharp` — and failed every time. The reason was not the advisories. Three copies of `postcss`
  (8.4.31, 8.5.23, 8.5.25) and three of `esbuild` (0.18.20, 0.25.12, 0.28.1) were installed at once.
  The patched versions were **already in the tree**; old ones sat beside them, pinned by a parent's
  range rather than by `package.json`. Dependabot edits manifests, so there was nothing to edit.

- **Fix**: `overrides`, which forces one version across the whole graph. Both targets were versions
  already installed, so it deduplicates rather than introducing anything — `postcss` to 8.5.25 and
  `esbuild` to 0.28.1, and both collapsed to a single copy.

- **The setting has moved, and pnpm said so rather than ignoring it.** `pnpm.overrides` in
  `package.json` is where every guide still puts it; under pnpm 11 the field is **not read**. The
  install printed `The "pnpm" field in package.json is no longer read by pnpm` and carried on with
  `Already up to date` — which, without the warning, would have looked exactly like a fix that
  worked. It belongs in `pnpm-workspace.yaml` now.

- **`sharp` was left alone deliberately.** Which version fixes those libvips CVEs is not something
  to guess at for a native image library, and the path is unreachable here — nothing uses
  `next/image`, so libvips is never entered. Waiting for Next to bump it is the honest answer.

- **Lesson**: **an advisory names a package, not a copy of it.** A lockfile can hold several
  versions of one dependency, and "we upgraded it" can be true of the copy you edited and false of
  the one that got installed. Whatever tool reports the alert is reading the lockfile, so the
  question worth asking first is not "is it patched?" but "how many of it are there?"

## A hardening change that took production sign-in down

- **Issue**: `auth.ts` carried `trustHost: true` with a comment explaining that Vercel preview
  deployments serve from a different host each time. An outside review flagged the unconditional
  value as something an interviewer would poke at, and suggested gating it on `VERCEL_ENV` or
  setting `AUTH_URL` in production. Both were done. Production sign-in returned
  `?error=Configuration` — "Sign-in is not configured correctly" — for every visitor.

- **Cause**: `trustHost` is not about having a canonical URL. It controls whether Auth.js will
  read the forwarded host headers. Every request to this app arrives through Vercel's proxy, which
  terminates TLS and sets those headers itself, so with `trustHost: false` Auth.js cannot resolve
  the callback for the request in front of it — in production exactly as much as on a preview.
  `AUTH_URL` pins the URL Auth.js _advertises_, not the host it is _allowed to read_, so setting
  it changed nothing. Nor did setting it to the `/api/auth` form.

- **Why nothing caught it.** Three layers, three reasons, and the third is the one worth keeping.
  The unit and integration suites never construct a request through a proxy. The E2E suite runs
  against `localhost`, where the header does not exist. And **the change was gated on
  `VERCEL_ENV === "production"`, which is the one branch a preview deployment never takes** — so
  the preview built for the pull request exercised the _old_ path and went green. Production was
  the first place that code ever ran.

- **What the trace showed**, once there was one: the form POST succeeded and returned
  `x-action-redirect: /api/auth/signin/github`, so the action, the CSP and `form-action 'self'`
  were all fine. The failure was inside Auth.js's own handler, which bounced back to
  `/sign-in?error=Configuration`. That narrowed six candidate causes to one in a single response.

- **Fix**: restored `trustHost: true`, with a comment that now says what it is _not_ — not blanket
  trust of a client-supplied `Host`, because the platform sets the forwarded value — so the next
  review does not reopen it. `AUTH_URL` stays: harmless, and it does pin the advertised URL.

- **Lesson**: two, and the second is the general one.

  **A recommendation can be correct in general and wrong for the platform.** The review's threat
  model — a forged `Host` steering an OAuth callback — is real on a bare Node server exposed
  directly. Here the proxy is what makes the unconditional value safe. The finding was accepted as
  a defect without checking whether its premise held for this deployment, which is the same shape
  as an earlier note in this file: a report can be accurate about the code and wrong about the
  project.

  **Anything gated on `VERCEL_ENV === "production"` has no rehearsal.** Preview deliberately takes
  the other branch, so the production path is unexercised until it is live, and no amount of CI
  changes that. Such a change needs either a way to force the production branch in a preview, or
  the acceptance that it ships untested — stated out loud, not assumed away.

## A finding that lost its second option in transcription

- **Issue**: an outside review raised the unused GIN full-text index on `chunks`, and offered
  **two** acceptable resolutions: "Either drop it in a migration and note that re-adding it is one
  statement, **or** add a line to ADR 021 saying it is deliberately pre-built." What reached
  `docs/backlog.md` was the first option as a directive, plus a sentence the review never wrote —
  "an index nobody reads is the clearest possible waste" — and a ranking of **first of six** on the
  grounds that it was the smallest.

- **Cause**: the distortion happened in the paraphrase, not in the review. The review's own factual
  claim is that "ADR 021 is explicit that nothing queries it", which is a misreading of one clause;
  ADR 021 actually says the index is "unused by the product **and exercised by the evaluation**" —
  `pnpm eval:retrieval` issues the query the index exists for, through `retrieveLexical`. But the
  review had already priced its own finding correctly by leaving the keep-and-document path open,
  and the backlog entry closed it. Everything in that entry that sounds most confident is the part
  that came from nowhere.

- **What was and was not verified**: ADR 021's write-cost argument stands as written — ingestion is
  one ~1.8s embedding call for a 51-page PDF, so a GIN insert beside it does not show, and its
  Consequences section already calls the retained index "a real cost and a deliberate one". Not
  verified: whether the planner actually chooses the index at 51 chunks, which at that row count it
  very likely does not. That does not change the decision, and it does mean "the eval uses the
  index" is a claim about the query, not about a measured plan.

- **Fix**: no migration. The backlog entry now carries both of the review's options and says which
  was taken and why, plus the conditions that would reopen it. ADR 021 is unamended: the review's
  suggested wording — pre-built "for the reranking work" — would have been a false reason, since a
  reranker over the top _k_ does not read a full-text index.

- **Lesson**: **a finding survives being transcribed only if its alternatives survive with it.** A
  review that says "either A or B" becomes an instruction to do A the moment it is summarized into
  a task list, because task lists hold actions and not choices. The expensive findings in this
  review kept their nuance — a missing `workspace_id` was argued against the code before being
  accepted — while the cheap one lost its second option and gained a rhetorical flourish, precisely
  because a one-line migration does not feel like it needs a defense. The cost of _checking_ a
  finding is unrelated to the cost of acting on it. The prior entry here says a report can be
  accurate about the code and wrong about the project; this one is narrower and less flattering —
  the report was fine, and the summary of it was not.

## A test whose central assertion was a race with the runtime

- **Issue**: proving that an oversized upload is refused _without being buffered_ needs an
  assertion about what the route did **not** do. The obvious construction is a request whose body
  throws when read — give it a `ReadableStream` whose `pull()` sets a flag, then assert the flag is
  false. It passed. Run as part of the full integration suite, it failed with
  `expected true to be false`.

- **Cause**: **undici pulls a stream request body a tick after the `Request` is constructed**,
  whether or not anything consumes it. Measured directly:

  ```
  immediately after construction: false
  after a tick:                   true
  ```

  So the flag flips on its own. Alone, the assertion ran before that tick and passed; in a longer
  run, ordinary async work let the tick land first. The test was not measuring the route — it was
  measuring which of two unrelated things happened first.

- **Why the status code was not a fallback either**: without the precheck the route answers
  **400**, not 200 — `formData()` rejects on a body it cannot parse as multipart, and the handler
  catches it. So `expect(413)` does fail without the fix, but for a reason that has nothing to do
  with buffering. A red test can be right about the outcome and silent about the claim.

- **Fix**: assert the negative directly. Build the request with only a `content-length` header and
  no body at all, replace `formData` with `vi.fn()`, and assert it was never called. Nothing is
  timing-dependent, and the assertion now states the actual requirement — _the route must not call
  `formData()`_ — rather than a proxy for it. It fails without the precheck with
  `expected "vi.fn()" to not be called at all, but actually been called 1 times`.

- **Lesson**: **an assertion about something not happening needs a clock-free way to observe it.**
  The flag-and-throw pattern reads like a trap and is really a stopwatch: it asks whether the
  runtime got there before the assertion did. Spying the call is the same intent without the race.
  The tell was available and I ignored it — a test that passes in isolation and fails in a suite is
  reporting a shared clock or shared state, and the first question is which, not "flaky".

## A throttle that spent its interval on work that failed

- **Issue**: gating two housekeeping sweeps behind `atMostEvery` turned a two-second poll from
  60 writes a minute into one. Review found three things wrong with how, and they share a root.

- **The gate advanced before the work ran.** `if (isDue()) await sweep()` claims the interval,
  then does the thing. If the sweep throws — Neon dropping a connection is the ordinary case —
  the window is spent and the sweep is skipped until the next one. Worse than it sounds here:
  `GET /documents` is only polled while a document is `queued` or `processing`, so "the next
  window" can be the next upload rather than the next minute.

- **The name invited the misuse.** `staleSweepIsDue()` reads as a predicate and mutates on call.
  The doc comment said so; the name is what a reader sees at the call site. Any later refactor
  that reads it twice — a log line, an early return, hoisting it into a precondition — disables
  the sweep silently, and the route test would still see exactly one call.

- **Fix**: the gate takes the work. `atMostEvery(60_000)(failStaleProcessing)` runs it, advances
  the interval **only on success**, and returns whether it ran. One change removes both problems:
  the interval cannot be claimed without doing the work, and there is no predicate to read twice.
  It also moved to `performance.now()`, which is monotonic — `Date.now()` going backwards over an
  NTP step would leave the deadline in the future and hold the gate shut for the length of the
  jump.

- **The test was order-dependent and hid it.** `mockClear()` reset the spy but not the
  module-level gate, so "five polls, one sweep" only passed because it was the first `GET` in the
  file; anything added above it would fail as _the throttle is broken_. The test owns an injected
  clock now. First attempt at that was wrong too — resetting the clock to zero **shuts** a gate
  holding a deadline rather than opening it, so it moves forward instead. Verified by inserting
  an earlier `GET` and re-running.

- **Lesson**: **an API shaped as a question will be answered twice.** `isDue()` and
  `run(work)` express the same policy, but only one of them can be misused by a refactor that
  looks harmless, and only one can distinguish "the work happened" from "we decided it should".
  The check-then-act split is where the failure lives — a throttle that cannot separate deciding
  from doing cannot get the failure case wrong.

## The same transcription failure, twice, in the same list

- **Issue**: a review flagged that chat tokens might go unrecorded when a reader closes the tab.
  Its own words: `onFinish` is "**not guaranteed** to run"; it "could not verify this against the
  installed SDK ... treat it as _worth confirming_ rather than confirmed"; and, concretely,
  "**Verify:** an integration test that aborts the fetch after the first byte and then asserts a
  `chat` usage row exists."

  What reached the backlog was "`onFinish` **never fires** on an aborted stream, so the provider
  was paid and the limiter never learned", with an action to record on abort.

- **What the measurement says**: it fires on a stream canceled mid-flight, writing both the usage
  row and the complete turn. Not "full usage" — the fake model zeroes its token counts by design,
  so no test here can check a total, and review caught that phrasing overclaiming in the very
  entry about overclaiming. The
  reason is an absence — `streamText` is never given an `abortSignal`, so a client disconnect does
  not stop generation. There was no defect.

- **Why the first probe was worthless**: canceling the route's stream showed usage recorded, but
  the project's fake model had `chunkDelayInMs: 0`, so the stream had already finished before the
  cancel. A probe against a fixture that cannot exhibit the condition is not evidence either way.
  `fakeChatModel` now takes a delay, so the slow case is reproducible in CI rather than in a
  scratch file — the first draft of this note cited a measurement nothing in the repo could
  repeat, which is the same failure the note is about.

- **This is the second time.** The entry above about the GIN index is the same failure: a review
  offered "either drop it or record that it is deliberate", and the backlog kept only the first
  half as a directive. Here a hedge became a fact and "confirm this" became "fix this". Both times
  the summary was more confident than the source, and both times the confidence pointed at work
  that was not needed.

- **Three things were lost in one paragraph**, which is what makes it a pattern rather than a slip:
  the uncertainty, the experiment that would have resolved it in ten minutes, and two side facts —
  that `persist` is affected as well as the usage row, and that the caps survive regardless because
  the embedding row is written before the stream opens.

- **Fix**: no production change. An integration test pins the behavior, and `route.ts` now says
  the missing `abortSignal` is deliberate — forwarding `request.signal` is the obvious improvement
  and is exactly what would introduce the reported bug.

- **And the first version of that test was vacuous**, which review caught. It canceled the
  _response body_ reader, and canceling a body leaves `request.signal.aborted` false — so adding
  `abortSignal: request.signal` would have left it green while production lost the row on every
  disconnect. A test named for a regression it cannot detect is worse than none, because it
  answers the question a future engineer actually asks. It now aborts an `AbortController` passed
  into the request, and was checked by making the change it guards against: `expected +0 to be 1`.

- **Lesson**: **hedged language in a review is data, not padding.** "Not guaranteed", "worth
  confirming", "I could not verify" are the author telling you where the evidence stops, and they
  are the first thing lost when a finding is compressed into a task. A backlog entry that reads
  more confidently than its source has been edited into a claim nobody made. Where a review names
  the experiment, run it before writing the entry — that is cheaper than the entry.

## One class change, three stale artifacts, and a grep that could not see two of them

- **Issue**: bumping the citation highlight from `bg-primary/20` to `bg-primary/30` and adding an
  underline was four tokens in one `className`. It invalidated three things elsewhere, none of
  them code, so nothing could fail: **ADR 023**, which named `bg-primary/20` in three places and
  carried a contrast table measured at that alpha; and **two README screenshots**, which show the
  panel with the old tint and no underline.

- **And the refactor beside it missed two of its own call sites.** Extracting the page gutter
  converted twelve, and the grep that verified it searched for the literal
  `mx-auto w-full max-w-`. Two sites are written `mx-auto flex w-full max-w-…` — a class in the middle — so the
  check could not match them however many times it was run. One of the two sat thirty lines above
  a block the same commit had converted.

- **What the check was actually doing.** Confirming, not testing. It could return "clean" whether
  or not the work was complete, because the pattern it searched for was narrower than the pattern
  the code uses. A verification that cannot produce a counterexample is a restatement of the
  claim — and this is the third time in a fortnight: the throwing-stream test that measured a
  clock, the contrast computed from `--card` when the panel paints `--background`, and now this.

- **Fix**: both sites converted, and re-verified with `mx-auto[^"]*max-w-[0-9a-z]+[^"]*px-3` —
  fourteen call sites, zero raw gutters. ADR 023 gained an `↳ Amended` block rather than an edit,
  so the `/20` measurement stays on the record as what was true when the decision was made. The
  screenshots were regenerated, and `answer.png` came back **byte-identical**, which is the
  evidence that only the panel changed.

- **Lesson**: **a change to something visual has a blast radius made entirely of things that
  cannot fail.** No test asserts that an ADR describes the current class, or that a screenshot
  shows the current UI, and no reviewer reads a PNG. The habit worth keeping is to ask, of any
  visual change, _what recorded a measurement of this_ — because the answer is usually a document
  and an image, and both go quietly wrong.

  For the grep: **write the check to find counterexamples, then confirm it can.** Searching for a
  literal you already know is present tests nothing. Had the pattern been run against the file
  before the refactor and returned fourteen, twelve would have been visibly short.

## Four tested files that no user could reach

- **Issue**: the plan for local mode's first slice listed "capability detection **and the mode
  toggle**", so I built both — a `citeseek_mode` cookie, a `modeFromCookie` parser with four
  fallback tests, and a server action to set it, all modeled on the theme cookie in ADR 018.
  Everything passed. Nothing used it. Local inference does not exist until slice 6, so the cookie
  recorded a preference that no code read and a toggle would have switched between one option and
  the same option.

- **Why it survived to the point of review**: every signal was green. The tests were real tests
  of real behavior — `""`, `"LOCAL"` and `"../../etc"` all fall back to `cloud`, and they do. Type
  checking, linting and the build have nothing to say about correct code that is never called.
  The plan said to build it, and a plan is the one artifact that sounds like a requirement.

- **The precedent that named it**: [ADR 016](decisions/016-workspace-membership-deferred.md)
  rejected a `role` column whose only production value would be `owner` — a branch no user can
  reach, carrying the cost of being maintained and the risk of being trusted. A preference nobody
  honors is the same object with a different shape.

- **Fix**: `lib/local/mode.ts`, its test and `lib/local/actions.ts` deleted; the cookie ships in
  the slice that reads it. ADR 027 records the cut in its consequences, so the reasoning survives
  the deletion rather than being rediscovered.

- **Lesson**: **a plan is a hypothesis about the order of work, not a specification.** Written
  before slice 1 existed, it grouped the cookie with detection because they are both "the toggle
  feature" — a grouping that stops making sense the moment you notice one half has no counterpart
  to switch to. The question that catches this is not "does it work" but **"what breaks if I
  delete it"**, and the honest answer here was: four files, and nothing else.

## A library that hangs, and two confident wrong answers, 11 August 2026

- **Issue**: local ingestion was built around a Web Worker, so parsing would not block the
  page. Word, Markdown and plain text parsed correctly. PDF did not: `unpdf` inside the
  worker **neither resolved nor threw**. The upload sat on "Parsing…" forever.

- **Every signal was green.** All worker chunks loaded 200. The browser console was empty.
  An `unhandledrejection` listener added inside the worker never fired. There was no error
  to read because there was no error — the promise simply never settled, and `try/catch`
  has nothing to say about code that stops rather than fails.

- **Two hypotheses, both confidently wrong.** First: the CSP. `/local` gets
  `'wasm-unsafe-eval'` but not `'unsafe-eval'`, and PDF.js is known to use `eval` on some
  paths — a tidy story that also explained why mammoth was unaffected. It failed identically
  under `pnpm dev`, which _does_ carry `'unsafe-eval'`. Second: the worker itself. Also
  wrong — Word parses in that same worker. What settled it was replacing the worker with a
  main-thread parse: all five ingest specs passed immediately. Each test cost about a minute
  and eliminated a whole branch, which is the argument for running the cheap one before
  reasoning further.

- **Fix**: parse on the main thread and delete the worker rather than keep it for the three
  formats it handled — that would have been a runtime branch on file type with PDF still
  broken. **Then measure, because "moved it to the main thread" invites the obvious
  objection.** Upload to rendered result: ~0.40s for a 2-page PDF, ~0.43s for a 51-page one.
  Identical, so the cost is the one-off `import("unpdf")` rather than parsing, and the worker
  had been guarding a stall that does not exist at this size. ADR 030.

- **A real defect the suite caught on its own**: the visually-hidden file input had no
  accessible name. The `/local` axe sweep written in an earlier slice failed with "Form
  elements must have labels", impact critical, in both themes — no new test required.

- **Lesson**: **the absence of an error is not evidence of success, and an instrument can be
  the thing that is silent.** Playwright's `page.on("console")` does not receive worker
  output, and I read that silence as "no error occurred" for several runs. Before concluding
  that nothing went wrong, confirm the instrument can see the place the work is happening.
  Second: when a fix moves work somewhere slower, measure before writing the apology — the
  number here removed the tradeoff entirely rather than quantifying it.

## Comments that lost their own subject, 11 August 2026

- **Issue**: four comments in the local-mode code were missing the identifiers they
  existed to name. `content-security-policy.ts` read "the file URL on redirects to a
  regional CDN ( here), and a redirect target is checked against in its own right" — in the
  file that _is_ the CSP seam, naming none of the three things it was written to name.
  `local-data-controls.tsx` read "— on a disabled button is a no-op". Two of the four were
  already merged.

- **Cause**: writing them through `node -e "...backtick..."` inside a double-quoted bash
  string. The shell reads a backtick pair as command substitution, runs
  `` `focus()` `` as a command, and splices the empty output in. Every affected comment
  used backticks around an identifier, which is exactly the house style.

- **Why nothing caught it**: Prettier reformats comments and does not read them; ESLint does
  not lint prose; the tests pass either way. A comment is the one artifact in the repo with
  no automated reader at all, so a corruption that would be obvious in code is invisible here
  until a human reads the line.

- **Fix**: all four rewritten through the editor rather than the shell. The rule going
  forward is that anything containing backticks, `$`, or `!` is written with an editing tool,
  never interpolated through a shell string.

- **Lesson**: **the tooling that writes a file is part of its correctness.** I chose `node -e`
  for speed on multi-line edits and it silently degraded the one thing in the diff that no
  linter, formatter or test inspects. Worth a grep before any commit that touched comments
  through a shell: `grep -rn "[a-z,)] \{2,\}[a-z(]"` over comment lines finds the swallowed
  identifiers, because the removed text leaves a double space behind.

## A comment that argued for the defect it was written to prevent, 12 August 2026

- **Issue**: `local-workspace.tsx` passes a refresh token to `LocalDataControls` as a prop.
  The comment above it said "Keyed so a finished ingest remounts the panel and it re-reads
  the store." Nothing is keyed and nothing remounts — but the comment it replaced had said
  the opposite, and said why: a `key` would recreate the `role="status"` region, and a live
  region that is absent at the moment the count changes announces nothing. That region is
  the only confirmation a screen reader gets that **Delete everything** worked.

- **Cause**: the slice moved the chat into this file and rewrote the surrounding comment from
  the code as it read at that moment. `refreshToken={ingested}` does look like a remount
  trigger; the reason it is not one is invisible from this file, which is exactly why the
  original comment existed.

- **Why nothing caught it**: the same blind spot as the swallowed identifiers above, one
  level up. Formatters and linters do not read prose, and here the tests could not help
  either — the code was correct, so every check passed while the diff shipped an argument
  for breaking it. The next reader "simplifying" the prop into a `key` would have been
  following the file's own instructions.

- **Fix**: the original comment restored verbatim.

- **Lesson**: **a comment in the "defect this prevents" category is load-bearing, and
  rewriting it from the current code cannot reconstruct it.** The code shows what is done;
  only the comment holds what was tried and rejected. When a diff touches one of these,
  the check is not "is the new sentence true" — this one nearly was — but "does it still
  name the thing that must not happen." If the rationale is not recoverable from the diff
  under review, the comment is not editable from the diff under review either.

## A green gate that proved the mock, 12 August 2026

Review of the merged local-answering branch found eight defects, seven of them in code that
branch had just written, and the gate had passed all of it: format, lint, typecheck, 668 unit
tests, 117 E2E and a production build, green.

- **Issue**: three of the seven were the same mistake in different clothes — a test that
  asserted our own stand-in rather than the library. `loadChatModel` passed no `device`, so
  transformers.js used its browser default of `wasm` while `WebGpuGate` refused the feature
  to anyone without an adapter; the progress filter kept the per-file `progress` event
  instead of the aggregate `progress_total` the library emits alongside it, so the readout
  hit 100% on a 4 KB config file; and `generateLocally` was covered by a mocked pipeline that
  echoed whatever it was handed. Each test passed because it described what our code sent,
  and nothing described what the library did with it.

- **Cause**: the mock was written from our side of the boundary. `vi.mock` of
  `@huggingface/transformers` is a fixture of _our expectations_ — and where the library
  wraps the callback we pass (`DefaultProgressCallback`, undocumented in the published
  types), our expectations were simply wrong. A mock cannot disagree with you.

- **Fix**: assert the arguments actually handed to `pipeline` — `device`, and which status
  the filter keeps — rather than only the shape of what comes back. The two-line check that
  `pipeline` was called with `{ device: "webgpu" }` is worth more than the four tests around
  it, because it is the only one that could have failed.

- **A separate one worth naming**: `text` became a required field on `LocalDocument` while
  `DATABASE_VERSION` stayed at 1. IndexedDB has no schema to reject the write, so documents
  from the previous release keep `status: "ready"`, retrieve, get cited — and only then does
  the panel report the passage missing. A schemaless store makes a migration look free, and
  the tests all ran against a database created fresh at the current version, which is the one
  case the defect cannot occur in.

- **Lesson**: **the tests you write against a boundary you control test the boundary, not
  what is past it.** Before trusting a suite over an integration, ask which assertion would
  fail if the library changed its behavior underneath — if the answer is none, the suite is
  measuring the mock. And for anything persisted, write the fixture at the _old_ version:
  every test that builds its store fresh is blind to migrations by construction.

## The bug that needed a person, 12 August 2026

- **Issue**: the local model's worked example was sent as `user`/`assistant` turns before the
  question. A model does not read those as an illustration; it reads them as things that were
  said. Typing `cite` returned "The passage [1] says the office closes at six" — the example's
  own user turn — with a marker that **resolved**, so the chip opened a real paragraph of the
  reader's CV. A fabricated claim wearing a working citation, reachable in one word, and
  deterministic under `do_sample: false`.

- **What every layer of review missed, in order.** The gate was green throughout: format,
  lint, typecheck, 683 unit tests, 117 E2E, production build. `/code-review` read the diff and
  found seven other defects without flagging this one. I wrote the example, noted the leak risk
  in my own head while writing it, judged it low because the text began with "Example.", and
  moved on. None of that was going to catch it.

- **Why the tests could not.** Two reasons, and the second is the interesting one. The suite
  fakes the generator so CI never downloads 756 MB, so nothing in it watches a real model read a
  real prompt. But the deeper problem is that the tests asserted the example was _present_ and
  its marker looked right — they described what we sent. They would have passed at full green
  no matter how badly the model answered out of it.

- **Fix**: the example moves into the system prompt and is built from the retrieved passage, so
  a parroting model quotes the reader's own document (ADR 035). The guard is an assertion about
  **shape**: the message array holds exactly the system prompt and the question. A leak cannot
  satisfy that.

- **Lesson**: **assert the shape of what leaves your process, not just its contents.** Content
  assertions encode what you meant; shape assertions encode what is structurally possible. Here
  the difference was "the example is in the prompt" — true, and useless — against "nothing but
  the system prompt and the question is in the array", which is the property that was violated.
  When something must never be true, find the assertion a bug cannot pass.

- **Second lesson, for the README rather than the code.** The same session showed three guards
  firing on real content — an invented marker left inert, model-emitted markdown links rendered
  anchorless, a grounded example quoting the reader — and every one of them looked like
  breakage. The reader who reported "that citation is not clickable" was the person who wrote
  the rule making it unclickable. A safety property that communicates nothing gets read as a
  defect and eventually gets "fixed".

## A guard that checked one of the two variables its code reads, 17 August 2026

- **Issue found**: `assertDisposableDatabase` refuses to let the integration suite run against a
  database it may not truncate. It checked `DATABASE_URL`. It did not check
  `DATABASE_URL_UNPOOLED` — and `retrieve.integration.test.ts` builds its forced-plan connection
  from `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, because a pooler rejects the startup options that
  test needs to force an HNSW-first plan. So a local `DATABASE_URL` beside a remote unpooled one
  passed the guard and then queried the remote database anyway.

- **How it surfaced**: not as a warning. The test returned `[]` and failed on an assertion about
  retrieval, which reads exactly like a product bug in the vector search. The connection was
  never mentioned. Only the fact that the same test had passed an hour earlier, on the same
  commit, made the environment the suspect instead of the code.

- **Fix**: the guard iterates every variable the suite can resolve a connection from, and its
  message names _which_ one is at fault rather than only the host. A test now covers the exact
  combination that slipped through — local pooled, remote unpooled — which is the counterexample
  the first version could not produce.

- **Lesson**: this is the repo's own note about `db:*` commands ("overriding one variable out of
  two", `DATABASE_URL_UNPOOLED ?? DATABASE_URL`) reappearing **inside the guard written to stop
  it**. The rule was known, written down, and applied to the commands; it was not applied to the
  check itself. **A guard has to cover every variable the guarded code can read, not the one the
  author was thinking about** — enumerate the fallback chain, do not name a variable.

- **Second lesson**: the guard was written and shipped in the same hour as a note claiming it
  closed this hazard class. It closed one member of it. `docs/backlog.md` already carries the
  older version of this observation — "a guard is shaped like the bug that produced it, and the
  next bug in the same family walks straight past it" — and this is that sentence happening to
  the guard that quoted it.

## A guard configured for a suite that does not exist, 17 August 2026

- **Issue found**: the document cap shipped with `PLAN_LIMITS: "off"` added to
  `playwright.config.ts`, carrying the comment "the signed-in suite shares one workspace, so a
  third upload anywhere would strand every spec after it." Every clause of that is false. There is
  no signed-in suite: GitHub OAuth cannot be driven from a browser test, so every spec runs as a
  guest against the demo — which is read-only for everyone, and whose conversations are never
  stored. The only upload in the whole suite is `/local`, which never reaches the server.

- **How it was caught**: not by review of the setting, which reads perfectly plausibly. By trying
  to write the next slice's E2E test and discovering there was no way to reach a signed-in
  workspace to hit the cap from. The question "why can't I test this?" is what exposed that the
  opt-out was protecting against nothing.

- **Fix**: the setting is gone. `PLAN_LIMITS=off` still exists in `resolvePlanLimits` and is unit
  tested; nothing sets it. The reason the caps have no E2E, and the trigger for revisiting, are in
  `docs/backlog.md`.

- **Lesson**: **the `USAGE_LIMITS` precedent was copied without checking that its premise
  transferred.** That one is real and measured — flipping it to production thresholds fails 6 of 7
  chat specs, and it is keyed on an IP address the whole suite shares. The stock caps are keyed on
  a workspace no spec can write to. Same shape of setting, opposite facts. Copying a neighbouring
  pattern is usually right and is exactly why it needs the same evidence the original had.

- **Second lesson, and the one that generalizes**: an unnecessary opt-out is not harmless. It is
  configuration that will silently swallow a real breach the day someone adds the authenticated
  spec — and its comment would have kept explaining why that was fine. This project's own file
  already says it: **a verification that cannot produce a counterexample is a restatement of the
  claim.** A limiter turned off in the only environment that could exercise it produces no
  counterexamples by construction.

## A destructive test helper with an implicit target, 17 August 2026

- **Issue found**: `pnpm test:integration` takes its database from `DATABASE_URL`, which
  `vitest.integration.config.ts` reads out of `.env.local` — the file that points a laptop at
  Neon. The suite calls `clearUsageEvents`, which is `db.delete(usageEvents)`: every row, no
  prefix, no scope. Correct against CI's throwaway container, and against a real database it
  empties the table behind the usage dashboard and the rate limiter.

- **How it was caught**: by needing to run the suite on a machine with no Docker and checking what
  `DATABASE_URL` actually resolved to before running it. Nothing about the command names its
  target, which is the whole defect.

- **Fix**: `assertDisposableDatabase` throws in the config, before any worker forks, unless the
  host is loopback or `INTEGRATION_DB_IS_DISPOSABLE=yes`. CI needs no exemption — a service
  container is port-mapped, so it is already loopback there. **The guard's first run refused a
  real Neon host**, which is the second time in this project a guard has opened by finding the
  failure rather than preventing it.

- **Lesson**: **the danger is not the destructive helper, it is that its target is implicit.**
  `clearUsageEvents` is right to be unscoped and its comment defends that well. What was missing
  was any statement of which database the command was entitled to do it to. `db:seed` already had
  this seatbelt in `SEED_HOST`; the integration harness was the one path without it, and the
  fourth instance of this project confusing one database for another.

- **Naming note**: the escape hatch is `INTEGRATION_DB_IS_DISPOSABLE`, not `ALLOW_REMOTE_DB`.
  The variable should state the claim that has to be true, not the restriction being lifted —
  someone setting the second is bypassing a check, someone setting the first is asserting a fact
  they can be held to.
