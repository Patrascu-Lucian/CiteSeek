# Strategy and build plan

What each milestone covers, and the constraints that hold across all of them.

> **This is a snapshot, and it is deliberately not kept up to date.** It describes the shape
> of the work, not its state. Nothing here is edited as milestones complete.
>
> Where the built result differs from what is described here, that difference is the
> interesting part, and it is explained where the decision was made rather than smoothed away
> in this file. [ADR 008](decisions/008-chunking-strategy.md), for one, records why the
> chunking numbers below were revised downward after the first production measurement.
>
> | Looking for                        | Read                                           |
> | ---------------------------------- | ---------------------------------------------- |
> | Which milestone is current         | the [README](../README.md) status line         |
> | Why a decision went the way it did | [`decisions/`](decisions/)                     |
> | Corrections caught in review       | [`code-review-notes.md`](code-review-notes.md) |
> | Work considered and not scheduled  | [`backlog.md`](backlog.md)                     |
>
> Snapshot taken July 2026.
>
> **The numbers below are the snapshot's, and they moved.** An unplanned milestone of hardening
> was inserted after Milestone 5, which pushed everything after it along, and a half-milestone
> was added before the optional work. Release tags use the current scheme, so a tag naming
> "Milestone 7" means in-browser inference rather than sign-in. This is a key, not a status:
>
> | Here                               | Since                             | Shipped as |
> | ---------------------------------- | --------------------------------- | ---------- |
> | —                                  | 6 — Hardening and reader feedback | `v1.1.0`   |
> | 6 — In-browser inference (stretch) | 7 — In-browser local mode         | `v1.2.0`   |
> | —                                  | 7.5 — Ready for strangers         | `v1.3.0`   |
> | —                                  | 8 — Editing and deleting a turn   | —          |
> | 7 — Email and password sign-in     | 8.5 — the same, still optional    | —          |
> | 8 — Billing                        | 9 — the same, plus the writing    | —          |

## Rules that hold across every milestone

**Deploy from day one, CI green from day one.** There is no integration phase at the end. A
live URL and a green pipeline exist before the first feature does, so every milestone ends
with something demonstrable in production rather than on a branch.

**When a milestone runs over, cut from inside it — never from the quality bars.** Scope is
the flexible part. The bars are not.

## The quality bars

1. **Unhappy paths are first-class.** Every async surface has loading, empty, error, retry
   and unauthorized states. No screen is only a spinner.
2. **Citations are real.** Every answer cites passage IDs, and clicking one opens the source
   scrolled to that passage. When retrieval finds nothing relevant the answer says so and
   cites nothing — a fabricated citation is worse than a refusal.
3. **Accessibility.** Keyboard-navigable chat, streaming announced politely to screen
   readers, focus managed across route changes, WCAG AA contrast.
4. **Tenant isolation is structural.** Every query helper takes a workspace scope; unscoped
   query functions do not exist. Vector search filters by workspace in the SQL itself, never
   by filtering results afterward. An integration test proves one workspace cannot retrieve
   another's passages.
5. **Data protection by design.** EU region throughout. Deletion is real and cascade-tested —
   text, passages and embeddings, not just a hidden row. Document contents and message bodies
   are never logged.

## Milestone 0 — Foundation

Next.js App Router, TypeScript strict, Tailwind and shadcn/ui. Postgres with pgvector,
Drizzle schema, Docker for local development. GitHub OAuth plus a guest session that needs no
account. CI running lint, typecheck, unit, integration, build and end-to-end. Deployed to
Vercel and Neon, both in the EU region, colocated
([ADR 006](decisions/006-deployment-topology.md)).

## Milestone 1 — Ingestion

Drag-and-drop upload with type and size validation and per-file progress. PDF, Word, Markdown
and text parsed to normalized text carrying page and offset metadata. Structure-aware chunking
([ADR 008](decisions/008-chunking-strategy.md)) into pgvector behind an HNSW index. Processing
states — queued, processing, ready, failed — with retry and a watchdog for work killed
mid-flight ([ADR 010](decisions/010-polling-vs-websockets.md)). Deletion that removes text,
passages and embeddings rather than hiding a row.

## Milestone 2 — Retrieval, chat and citations

Vector retrieval scoped to the workspace in SQL, with a relevance floor that refuses before
the model is called. Streaming answers with stop and regenerate, and streaming-safe markdown.
Numbered citation chips that open the source panel at the highlighted passage. A grounded
refusal when retrieval is weak, carrying no citations
([ADR 011](decisions/011-retrieval-and-citation-strategy.md)). Chat persistence for signed-in
users ([ADR 013](decisions/013-chat-persistence.md)). Integration tests against a mocked
model, and end-to-end coverage of ask → stream → cite.

## Milestone 3 — Hardening, accessibility and performance

Usage limiting with per-caller and global daily caps enforced server-side, guest traffic
limited harder than signed-in traffic ([ADR 014](decisions/014-usage-limiting.md)).
Prompt-injection hardening on the output side as well as the input side. A full unhappy-path
sweep across every screen. An accessibility pass with automated checks in the end-to-end
suite — treated as a floor rather than a pass, because a citation chip once rendered in the
same color as the bubble behind it: correctly labeled, fully functional, invisible, and
passing every automated check there is. Time-to-first-token and Lighthouse measured,
optimized, and written down.

## Milestone 4 — Product surface

Conversation history with rename and delete. Workspace management and roles enforced in route
handlers and query helpers rather than by hiding buttons. A usage dashboard built on data the
previous milestone already records. An account page, so deleting an account stops living in
the navigation header. A privacy policy naming subprocessors, hosting region, and exactly what
is stored.

## Milestone 5 — Documentation

The README as a case study: problem, architecture, tradeoffs, measured numbers. An
architecture diagram, and a short walkthrough of the core flow.

## Milestone 6 — In-browser inference (stretch)

A model-mode toggle between the cloud provider and a small model running locally over WebGPU,
with local embeddings and retrieval for small document sets — a mode where nothing leaves the
browser. Requires graceful capability detection: no WebGPU means an explanation and a
fallback, not a broken page.

## Milestone 7 — Email and password sign-in (optional)

Only if it earns its place after the above. OAuth and guest mode already cover the demo, and
password storage is a liability taken on deliberately or not at all.

## Milestone 8 — Billing

Not built speculatively. The usage accounting it needs exists from Milestone 3; the rest waits
for a first willing customer.

## Standing constraints

**Data residency.** Database, functions and storage are EU-region. Decided before the first
deploy, because migrating a live database between regions is painful and the in-browser mode
above doubles as a privacy feature rather than only a technical exercise.

**Provider tier.** The current model provider's free tier is for development and the public
demo only — its terms permit submitted content to be used for product improvement, which is
incompatible with how this project positions itself. A paid tier, or a provider under a data
processing agreement, is a prerequisite before any real user uploads a real document, and the
privacy policy must state whichever is live.

**Commercial optionality is protected, not pursued.** The decisions that would be expensive to
reverse — tenant isolation, EU residency, real deletion, usage accounting — are made correctly
now. Everything else waits ([ADR 007](decisions/007-commercial-optionality.md)).

**Licensing.** This repository is public but carries no license file, which means all rights
are reserved. Read it, learn from it, link to it; it is not licensed for reuse.
