# CiteSeek

AI document assistant: upload documents, ask questions, get streaming answers with
clickable citations to exact source passages.

> **Status: Milestone 0 — foundation.** The app scaffold, quality gates and CI are in
> place. Ingestion, retrieval and chat land in Milestones 1–2.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind v4 ·
shadcn/ui · Postgres 18 + pgvector · Drizzle ORM · Vitest + Testing Library ·
Playwright · GitHub Actions

Auth.js and the RAG pipeline arrive in the next slices.

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

Document upload, retrieval, and chat arrive in Milestones 1–2, so a workspace currently
shows an empty state. Email magic-link sign-in is deferred until an email sender is
configured — GitHub OAuth and guest mode both work. Tracked in
[`docs/backlog.md`](docs/backlog.md).
