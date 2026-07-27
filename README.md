# CiteSeek

AI document assistant: upload documents, ask questions, get streaming answers with
clickable citations to exact source passages.

> **Status: Milestone 0 — foundation.** The app scaffold, quality gates and CI are in
> place. Ingestion, retrieval and chat land in Milestones 1–2.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind v4 ·
shadcn/ui · Vitest + Testing Library · Playwright · GitHub Actions

Postgres + pgvector, Drizzle, and Auth.js arrive in the next slices.

## Getting started

Requires Node ≥ 22.11 and pnpm 11.

```bash
pnpm install
cp .env.example .env.local   # no values needed yet for Slice 1
pnpm dev                     # http://localhost:3000
```

## Commands

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm test         # vitest unit + integration
pnpm test:e2e     # playwright (builds and serves automatically)
pnpm lint         # eslint, type-aware
pnpm typecheck    # tsc --noEmit
```

All four of `build`, `test`, `lint`, `typecheck` must pass before anything merges —
CI enforces this on every pull request.

## Project conventions

- **Decisions** worth defending are recorded in [`docs/decisions/`](docs/decisions/).
- **Corrections made on review** are logged in [`docs/code-review-notes.md`](docs/code-review-notes.md).
- **Out-of-milestone ideas** go to [`docs/backlog.md`](docs/backlog.md), not the current branch.

Built with AI-assisted tooling (Claude Code) under close review — see
[`docs/decisions/`](docs/decisions/) for the architectural reasoning.

## Known gaps at this milestone

The landing page CTAs (`/sign-in`, `/demo`) are not implemented yet — they arrive with
Auth.js and guest mode in Slice 3. Tracked in [`docs/backlog.md`](docs/backlog.md).
