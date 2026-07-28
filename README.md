# CiteSeek

AI document assistant: upload documents, ask questions, get streaming answers with
clickable citations to exact source passages.

**Live:** [cite-seek.vercel.app](https://cite-seek.vercel.app) — click **Try the demo**;
no account needed.

> **Status: Milestone 1 complete.** Upload a PDF, Word document, Markdown or text file and
> watch it parse, chunk, embed and become searchable. Retrieval and chat land in Milestone 2.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind v4 ·
shadcn/ui · Postgres 18 + pgvector · Drizzle ORM · Auth.js v5 · Vitest + Testing Library ·
Playwright · GitHub Actions · Vercel + Neon

## Getting started

Requires Node 24 (see `.nvmrc`) and pnpm 11.

```bash
nvm use                      # Node 24 LTS
pnpm install                 # also enables the git hooks in .githooks/
cp .env.example .env.local   # fill in DATABASE_URL
docker compose up -d         # or point DATABASE_URL at a Neon branch
pnpm db:migrate
pnpm db:seed
pnpm dev                     # http://localhost:3000
```

## Commands

```bash
pnpm dev               # dev server
pnpm build             # production build
pnpm test              # vitest unit tests (no database needed)
pnpm test:integration  # vitest against a real Postgres (needs DATABASE_URL)
pnpm test:e2e          # playwright (builds and serves automatically)
pnpm lint              # eslint, type-aware
pnpm typecheck         # tsc --noEmit
pnpm format            # prettier --write
```

Database:

```bash
docker compose up -d   # local Postgres 18 + pgvector
pnpm db:migrate        # apply migrations (creates the vector extension too)
pnpm db:seed           # demo workspace; idempotent
pnpm db:generate       # emit a new migration after editing lib/db/schema.ts
pnpm db:studio         # browse the database
```

`format:check`, `lint`, `typecheck`, `test`, `build`, integration tests, and the
Playwright smoke suite all gate every pull request.

## Numbers

Measured, not estimated. Each figure is the median of five `curl` requests from a European
vantage point; the first sample in each set includes a cold start and is kept in the data
rather than discarded.

**Function region colocation** — moving Vercel Functions from the default `iad1`
(Washington DC) to `fra1` (Frankfurt), beside the Neon database:

| Route                              | Before | After  |          |
| ---------------------------------- | ------ | ------ | -------- |
| `/sign-in` — dynamic, no query     | 234 ms | 149 ms | −36%     |
| `/demo` — dynamic + database query | 395 ms | 134 ms | **−66%** |

The `/demo` result is the interesting one: it went from _slower_ than a route that touches
no database to marginally faster. Every query had been crossing the Atlantic twice.
See [`docs/decisions/006-deployment-topology.md`](docs/decisions/006-deployment-topology.md).

**Ingestion**, measured on the deployed app from the document's own status
timestamps — a 51-page PDF, 1.03 MB, producing 32 passages:

| Stage                  | Elapsed    |
| ---------------------- | ---------- |
| Upload → `processing`  | 347 ms     |
| `processing` → `ready` | 1,456 ms   |
| **Total**              | **1.80 s** |

Against the 300-second serverless ceiling that is 0.6% of budget, which is what settles
whether background ingestion needs a queue: it does not. Extrapolating to the 600-chunk
document limit gives roughly 19 embedding batches at 2 concurrent calls — on the order of
tens of seconds. The binding constraint is the embedding provider's requests-per-minute,
not function duration.

The sample is a design document at roughly 517 characters per page, so it is light on text
for its page count; a dense report of the same length would produce closer to 500 passages.
The figure above proves the path works end to end in production, not that the ceiling has
been stressed.

Lighthouse and TTFT targets are Milestone 3.

## Testing

| Layer       | Count | What it covers                                                             |
| ----------- | ----- | -------------------------------------------------------------------------- |
| Unit        | 214   | Chunking, extraction, embeddings, validation, auth rules, UI components    |
| Integration | 45    | Real Postgres: ingestion, tenant isolation, cascades, vector constraints   |
| E2E         | 25    | Guest flow, route protection, read-only demo, session exit, keyboard paths |

The pure core — `lib/rag` and `lib/ai` — is held to ≥90% coverage, enforced in CI.

A deterministic fake embedder (`EMBEDDINGS_PROVIDER=fake`) exercises the whole ingestion
path with no API key and no network, so CI and local development need neither. It proves the
pipeline stores and orders correctly; it says nothing about retrieval quality, which needs
the real provider.

Integration tests run against a throwaway pgvector container in CI rather than a shared
database, so they also prove the migration applies cleanly to an empty database on every
pull request.

## Branching

`main` is protected by a `pre-push` hook in [`.githooks/`](.githooks/): direct pushes are
refused, so every change goes through a pull request and CI runs before it lands. The hook
is enabled by `pnpm install`; if it ever seems inactive, run `pnpm run prepare`.

This is a local guard rather than a security control — `--no-verify` bypasses it. It exists
to catch an absent-minded `git push origin main`, which is the realistic failure mode on a
solo repository. Server-side enforcement needs GitHub branch protection, which is free on
public repositories but requires a paid plan for private ones.

## Project conventions

- **Decisions** worth defending are recorded in [`docs/decisions/`](docs/decisions/).
- **Corrections made on review** are logged in [`docs/code-review-notes.md`](docs/code-review-notes.md).
- **Out-of-milestone ideas** go to [`docs/backlog.md`](docs/backlog.md), not the current branch.

Built with AI-assisted tooling (Claude Code) under close review — see
[`docs/decisions/`](docs/decisions/) for the architectural reasoning.

## Known gaps at this milestone

Retrieval and chat arrive in Milestone 2, so an ingested document is searchable in the
database but there is nothing to ask yet. Email magic-link sign-in is deferred until an
email sender is configured — GitHub OAuth and guest mode both work. The demo workspace is
read-only by design, so uploading requires signing in. Tracked in
[`docs/backlog.md`](docs/backlog.md).
