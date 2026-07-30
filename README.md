# CiteSeek

AI document assistant: upload documents, ask questions, get streaming answers with
clickable citations to exact source passages.

**Live:** [cite-seek.vercel.app](https://cite-seek.vercel.app) — click **Try the demo**;
no account needed.

> **Status: Milestone 3 complete.** Upload a PDF, Word document, Markdown or text file, then
> ask questions about it. Answers stream, and every claim carries a numbered citation that
> opens the source document scrolled to the exact passage. When nothing relevant is found,
> the answer says so and cites nothing.
>
> What each milestone covers is in [`docs/strategy-plan.md`](docs/strategy-plan.md). This
> line is the status; that document is the plan.

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

Measured, not estimated, from a European vantage point against the deployed app unless a row
says otherwise. Latency figures are medians of repeated requests, and the first sample in each
set includes a cold start and is kept in the data rather than discarded. Where a measurement
needed a different method — a streamed response, or a headless browser — the method is stated
beside it, because "1 second" means nothing without knowing what was being timed.

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

**Time to first token** — the deployed app, as a guest, asking a question the demo document
answers. Two figures, because only one of them is TTFT:

| Measured from request start        | Median |
| ---------------------------------- | ------ |
| First byte of the stream (sources) | 461 ms |
| **First token of the answer**      | 1.03 s |

The stream opens before the model is called at all: the citation payload is written first, as
a fact about retrieval rather than a summary of what the model claimed. So a reader sees
sources resolve at ~460 ms and prose begin at ~1 s.

Four samples rather than five — the fifth was refused by this project's own rate limiter,
which is the intended behavior and a reasonable way to find out it works in production.

**Client bundle**, measured by reading the scripts the page actually serves. The Milestone 2
entry here claimed the 428 KB markdown chunk — a parser, a
diagram renderer, a syntax highlighter and a maths typesetter — was lazy and absent from the
initial payload. **Measuring it showed the opposite**: it was in the initial HTML of every
workspace visit. Loading `Answer` through `next/dynamic` fixed that, since no conversation
needs a markdown renderer before it has an answer in it:

Before and after are both the local production build, so the comparison is like for like:

| Scripts on `/w/[id]` | Before  | After   |          |
| -------------------- | ------- | ------- | -------- |
| Raw                  | 1670 KB | 1244 KB | −26%     |
| Transferred          | 468 KB  | 338 KB  | **−28%** |

The deployed app measured 1671 KB / 459 KB before the change, which is the same build within
compression noise — worth stating, because a before/after that quietly swaps environments
mid-table is how a real regression gets hidden by an unrelated improvement.

**Lighthouse**, mobile emulation with its default throttling (Slow 4G, 4× CPU). The workspace
needs a guest cookie: `proxy.ts` redirects a credential-less `/w/*` to `/sign-in`, so an
anonymous run scores a different page entirely.

| Page                               | Performance | Accessibility | Best practices | SEO |
| ---------------------------------- | ----------- | ------------- | -------------- | --- |
| `/` landing — deployed             | 98          | 100           | 100            | 100 |
| `/w/[id]` guest — deployed, before | 87          | 100           | 100            | 100 |
| `/w/[id]` guest — local build      | 84 → **90** | 100           | 100            | 100 |

The workspace page is short of the 95 target and the reason is specific: 124 KB of the
remaining bundle is unused Vercel AI SDK and Zod, reachable only by deferring `useChat` —
which would delay the composer becoming interactive. Trading the product's primary interaction
for five points is the wrong way round, so the gap is recorded rather than closed. LCP is the
chat panel's empty-state text, and its breakdown is 20 ms of server time against 437 ms of
render delay, so the remaining cost is script evaluation rather than anything the database
does.

## Testing

| Layer       | Count | What it covers                                                                              |
| ----------- | ----- | ------------------------------------------------------------------------------------------- |
| Unit        | 381   | Chunking, extraction, embeddings, prompts, citation markers, usage policy, answer rendering |
| Integration | 97    | Real Postgres: ingestion, retrieval, chat route, usage limits, tenant isolation, cascades   |
| E2E         | 47    | Guest flow, route protection, ask → stream → cite → source panel, capacity states, axe      |

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

- **The milestone plan** is in [`docs/strategy-plan.md`](docs/strategy-plan.md) — a snapshot,
  not a status page.
- **Decisions** worth defending are recorded in [`docs/decisions/`](docs/decisions/).
- **Corrections made on review** are logged in [`docs/code-review-notes.md`](docs/code-review-notes.md).
- **Out-of-milestone ideas** go to [`docs/backlog.md`](docs/backlog.md), not the current branch.

Built with AI-assisted tooling (Claude Code) under close review — see
[`docs/decisions/`](docs/decisions/) for the architectural reasoning.

## Known gaps at this milestone

Guest conversations are not saved — a reload starts over. That is deliberate: persisting them
would put an unbounded write path behind a public URL
([ADR 013](docs/decisions/013-chat-persistence.md)). Conversation history, rename and delete
are Milestone 4.

The workspace page scores 90 on Lighthouse rather than the 95 this project set as its bar. The
cause is measured and recorded above; closing it means deferring chat hydration, which is a
worse trade than the points are worth.

The relevance threshold that decides when to answer "I don't know" is a starting value, not a
tuned one; it needs measuring against real documents with the real embedding model. The demo
document is Markdown, so its citations show a filename but no page number.

Usage limits are enforced but their thresholds are provisional in the same way — they need
real traffic to calibrate against, and are deliberately generous because shared addresses
(office networks, mobile carriers) put many visitors in one bucket
([ADR 014](docs/decisions/014-usage-limiting.md)).

Email magic-link sign-in is deferred until an email sender is configured — GitHub OAuth and
guest mode both work. The demo workspace is read-only by design, so uploading requires signing
in. Tracked in [`docs/backlog.md`](docs/backlog.md).
