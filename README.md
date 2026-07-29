# CiteSeek

AI document assistant: upload documents, ask questions, get streaming answers with
clickable citations to exact source passages.

**Live:** [cite-seek.vercel.app](https://cite-seek.vercel.app) — click **Try the demo**;
no account needed.

> **Status: Milestone 2 complete.** Upload a PDF, Word document, Markdown or text file, then
> ask questions about it. Answers stream, and every claim carries a numbered citation that
> opens the source document scrolled to the exact passage. When nothing relevant is found,
> the answer says so and cites nothing.

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

**Client bundle**, measured against the production build by reading the scripts the page
actually serves:

| Route     | Initial JS |
| --------- | ---------- |
| `/w/[id]` | 694 KB     |

The chat UI brought in `streamdown` for streaming-safe markdown — text arrives a token at a
time, so half-written markdown is the normal state rather than an error. It pulls a diagram
renderer and a syntax highlighter transitively, together 428 KB, and **neither appears in any
chunk the page loads**: both sit behind `React.lazy` and are fetched only if an answer
contains a diagram or a code block. Recorded as the baseline the Milestone 3 bundle budget
gets measured against, rather than a target invented afterwards.

TTFT and Lighthouse are Milestone 3.

## Testing

| Layer       | Count | What it covers                                                                     |
| ----------- | ----- | ---------------------------------------------------------------------------------- |
| Unit        | 306   | Chunking, extraction, embeddings, prompts, citation markers, highlighting, chat UI |
| Integration | 76    | Real Postgres: ingestion, retrieval, chat route, tenant isolation, cascades        |
| E2E         | 32    | Guest flow, route protection, ask → stream → cite → source panel, keyboard paths   |

The pure core — `lib/rag` and `lib/ai` — is held to ≥90% coverage, enforced in CI.

Deterministic fakes for both providers (`EMBEDDINGS_PROVIDER=fake`, `CHAT_PROVIDER=fake`)
exercise ingestion, retrieval and the whole answer path with no API key and no network, so CI
and local development need neither. The fake embedder is a hashing bag-of-words vectorizer:
text sharing words lands close together, which is enough for a real question to retrieve a
real passage end to end. It is not semantic, and says nothing about retrieval quality — that
needs the real provider, and the relevance floor is calibrated per embedding model for
exactly that reason.

A live model would also make "the answer cites `[1]`" a coin toss rather than an assertion.

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

Guest conversations are not saved — a reload starts over. That is deliberate: persisting them
would put an unbounded write path behind a public URL, and rate limiting arrives in Milestone
3 ([ADR 013](docs/decisions/013-chat-persistence.md)). Conversation history, rename and delete
are Milestone 4.

The relevance threshold that decides when to answer "I don't know" is a starting value, not a
tuned one; it needs measuring against real documents with the real embedding model. The demo
document is Markdown, so its citations show a filename but no page number.

Email magic-link sign-in is deferred until an email sender is configured — GitHub OAuth and
guest mode both work. The demo workspace is read-only by design, so uploading requires signing
in. Tracked in [`docs/backlog.md`](docs/backlog.md).
