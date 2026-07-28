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
  than afterwards — a gate that does not exist yet catches nothing.

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

- **Issue**: uploads on production returned a bodyless 500 while the workspace page rendered
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
