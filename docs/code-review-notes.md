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
