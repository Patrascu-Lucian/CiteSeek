# 039 — The default plan's ceiling: stock limits, and where they are enforced

**Status**: accepted · **Date**: 2026-08-17 · **Milestone**: 7.5

## Context

The product has one limit: a rolling-window rate limiter counting provider calls per minute and
per day ([ADR 014](014-usage-limiting.md)). It defends a finite quota against a bot, and nothing
bounds what one signed-in reader can accumulate — documents, conversations and stored messages are
unbounded, so the free plan has no ceiling to be an upgrade _from_.

Adding a ceiling looks like extending `enforceUsageLimits`. It is not.

## Two kinds of limit, and why one module cannot hold both

The distinction decides everything below, so it is worth naming.

A **flow limit** counts events in a moving window. It heals on its own: the window slides, the
count falls, and the caller is admitted without doing anything. "Too many requests in a short
time — wait a moment" is a _complete_ answer, and `Retry-After` is a true statement.

A **stock limit** counts things that exist. It never heals. Three documents stays three documents
until somebody deletes one. No amount of waiting changes it, so a retry header would be a lie, and
a message that does not name what to delete leaves the reader with no move at all.

`decideUsage` returns `rate_limited` and `capacity_reached`, both flow refusals. Putting a stock
refusal behind the same call would mean one function returning two refusals whose remedies
contradict each other — one says wait, the other says wait forever. So the caps live in
`lib/limits`, beside `lib/usage` rather than inside it, and the two are composed at the route.

What is copied is the _shape_: a discriminated union the route renders rather than re-derives.
That is what makes the paid tiers of Milestone 9 a rendering change instead of a second
enforcement path — the place a limit most easily ends up wrong is its second implementation.

## Where the check runs

The milestone brief said "enforce in the query layer, workspace-scoped like every other helper."
That is the right rule stated slightly wrong, and following it literally produces two defects.

`createQueuedDocument` runs _after_ `formData()` has buffered the whole upload. A cap there spends
4 MB of transfer and a full body read to produce a refusal that was certain before the first byte
arrived — the same waste the `content-length` pre-check already exists to avoid, argued in this
same route. And on the chat side, `appendMessages` is called from `onFinish`: a cap there refuses
after the model has streamed and been paid for, silently dropping a turn the reader watched
appear. That is the failure mode the conversation cap was carefully designed to avoid, arrived at
from the other direction.

What the rule protects against is enforcement **in the interface** — a hidden button, a disabled
control, a cap that a second client would not observe. That stands, and an integration test per
cap proves the route _refuses_ rather than that a button is missing.

The correction is a narrower statement: **enforce server-side at the earliest point that has no
side effects**, with the counts coming from workspace-scoped query helpers and the decision from a
pure function. Caps are policy. Tenant scoping is isolation. Conflating them is what pushes the
check into the wrong layer.

## The race, why it was accepted — and why that did not survive contact

`decideCap` is check-then-insert with no transaction, and `UploadDropzone` uploads concurrently —
it loops over the selection calling `upload()` without awaiting. So two requests can both read
`limit - 1` and both insert. The cap can be exceeded, by the ordinary path rather than an exotic
one.

Two things make this acceptable rather than merely known. The comparison is `>=`, so the state
converges: once over, every subsequent attempt refuses until the count comes back down. And the
thing being protected is a product ceiling, not a quota, a bill or a security boundary — the cost
of a fourth document existing is that somebody got a fourth document.

The correct fix is a `SELECT … FOR UPDATE` on the workspace row, serializing the check against
concurrent inserts. It is in `docs/backlog.md` with its trigger: an observed overshoot that
matters, or the first cap where the overshoot costs money.

**Closed on 19 August 2026, and the reasoning above was wrong in its load-bearing part.** Not the
mechanism — that was right — but "the state converges". Measured with six concurrent uploads at a
limit of three: **all six were admitted.** Every count resolves before any insert commits, so the
race does not merely sometimes lose, it loses every time, and convergence only begins after the
overshoot has already happened. "Somebody got a fourth document" was the optimistic reading of a
path that grants as many as are sent at once.

`createQueuedDocumentUnless` and `createChatUnless` now count, decide and insert inside one
transaction behind that `for update`. The lock is on the **parent** row because the rows being
counted do not exist yet — the workspace is what two concurrent requests have in common — and both
helpers take the same row so their lock order cannot differ. The early checks in the upload route
stay, refusing before 4 MB is buffered; they are an optimization now rather than the rule.

## What the document cap counts

**Every row, whatever its status.** The alternative — counting only documents that reached a
usable status — reads better and is bypassable: `createQueuedDocument` inserts before extraction
runs, so N concurrent uploads all pass a `ready`-only count at zero. That held even before the
race was closed: a `ready`-only count is not a weaker cap so much as no cap, since the rows it
declines to count are exactly the ones a burst creates.

The objection to counting rows is real: three failed parses sit at the ceiling with nothing
usable, and "delete one to upload another" would point at a working document. That is a copy
problem rather than a limit problem, and the check has already counted the statuses, so
`countDocuments` returns `failed` alongside the total and the refusal names it.

## Consequences

- A 409, not a 429. Nothing about a stock limit is transient, and the status code should not
  suggest otherwise.
- The refusal body carries `cap`, `limit` and `current`. A paywall renders those; it does not ask
  the server a second question.
- `PLAN_LIMITS=off` exists, on the `USAGE_LIMITS` pattern — unreachable thresholds rather than a
  skipped check, so the count query still runs on the real admission path. **Playwright does not
  set it**, and adding it was a mistake corrected the same day: no E2E can reach a signed-in
  workspace, so no spec can trip these caps. The reasoning and the trigger for revisiting are in
  `docs/backlog.md`.
- The cap holds under concurrency. Counting and inserting share one transaction behind a
  `for update` on the workspace row — see the amended section above, including what the first
  version of this bullet got wrong.
- Three more caps follow this shape: conversations on `createChat` only, saved messages as a route
  admission check ahead of retrieval, and extracted characters for storage. Each adds a `CapKind`
  and a call site, not a new mechanism.
