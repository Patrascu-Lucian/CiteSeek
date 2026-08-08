# 010 — Polling, not websockets, for ingestion status

**Status**: accepted · **Date**: 2026-07-28 · **Milestone**: 1

## Context

Ingesting a document takes seconds to minutes: parse, chunk, then embed in batches against a
rate-limited provider. The upload response cannot wait for that, so the work runs in
`after()` and the client needs some way to learn when a document becomes `ready` or `failed`.

The options are the usual three: poll, stream server-sent events, or open a websocket.

## Decision

**Poll a JSON endpoint every ~2 seconds, and only while at least one document is in a
non-terminal state.**

Polling stops entirely once every document is `ready` or `failed`, which is the normal
steady state — a workspace someone is reading, not uploading to, makes no requests at all.

### Why not websockets

A websocket is a stateful connection, and the platform this runs on is stateless by design.
Vercel functions do not hold long-lived connections; making it work would mean a separate
always-on service or a third-party realtime provider — a new dependency, a new failure mode,
and a new bill, to deliver an event every few seconds that a poll already delivers.

The connection would also have to be re-established after every sleep, tab suspend, and
network blip, and would need its own auth handshake distinct from the cookie the rest of the
app uses. That is a meaningful amount of machinery for a progress bar.

### Why not server-sent events

Closer to viable — SSE is one-way and works over plain HTTP — but it still holds a function
invocation open for the duration of the stream. On a plan where functions are billed by
duration and capped at 300 seconds, keeping one open to report on work happening in _another_
invocation trades a cheap request for an expensive one. It also gains nothing here: there is
no user-perceptible difference between learning about completion instantly and learning
about it within two seconds.

### What polling actually costs

One indexed query per interval per open workspace tab, returning a small JSON array. The
same request carries the stale-processing sweep, so looking at a stuck document is what
marks it failed — no cron, no queue, no separate worker.

**Amended:** that sweep, and the usage prune beside it, ran on _every_ poll, which made two
writes per two seconds on an endpoint that reads as a read. Both now sit behind a
per-process interval (`lib/sweeps.ts`) — stale documents at most once a minute, the prune
once an hour.

## Consequences

- **Up to ~2 seconds of latency** before a status change appears. For work that takes tens
  of seconds, this is invisible. One exception since the sweep was gated: `processing` →
  `failed` is now up to ~62 seconds, because it waits for the sweep's interval rather than
  the poll's. A document is only presumed dead after 10 minutes, so a minute on top of that
  changes nothing a reader would notice.
- **The client must stop polling.** An interval that keeps running against a finished
  workspace is a slow leak of requests and, on a metered function plan, of money. The
  condition is explicit: poll only while some document is `queued` or `processing`.
- **No realtime infrastructure exists to operate**, which also means none to secure. The
  status endpoint reuses the same cookie-based authorization as every other route.
- **Revisit if** the product later needs genuinely live multi-user updates — collaborative
  editing, or a shared workspace where one person's upload should appear on another's screen
  immediately. Streaming chat responses in Milestone 2 does _not_ count: that is a single
  response body streamed over one request, which HTTP already does.
