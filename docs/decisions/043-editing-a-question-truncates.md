# 043 — Editing a question truncates, and assistant turns are not editable

**Status**: accepted · **Date**: 2026-08-22 · **Milestone**: 8

## Context

A reader who words a question badly has two moves today: ask again below, which leaves the poor
question and its answer in the transcript, or delete the exchange and retype it from scratch.

## Decision

**Editing a question clears it and everything after it, then asks the new wording through the
ordinary chat route.** The answer below was grounded in the old words, and every turn after it
followed from that answer — keeping any of it would show a conversation that never happened.

**Assistant turns are not editable.** User-authored text rendering with citation chips that resolve
to real passages is a claim wearing a source it does not have, which is
[ADR 035](035-where-the-worked-example-goes.md)'s failure reached from the inside. An answer can be
deleted or regenerated; it cannot be rewritten.

**Two steps, not one.** The action truncates; the client then sends the edited question through the
same route every question uses. Teaching that route to replace a turn would put a second mode on
the hottest path in the product, and this way the re-ask is metered, rate-limited and grounded
exactly like any other question — no new path to keep in step.

**Truncating comes first, and that is a trade.** If the re-ask is refused — a daily cap, a dropped
connection — the old tail is already gone and the edited question survives only on screen. The
alternative is restoring it, which needs an endpoint accepting message content from the client, and
[ADR 042](042-one-rule-for-destroying-something.md) rejected that for the same reason as undo. So
the failure is: the transcript is shorter than it was, the reader still has their words, and a
reload loses the tail. Accepted, and it is why the action reports `{ cleared }` rather than
throwing — a clear that did not happen puts the transcript straight back.

## `edited_at` was planned and dropped

The milestone plan called for a nullable `messages.edited_at` and a quiet "edited" marker, on the
grounds that a question silently replacing its predecessor is a small lie in a transcript this
product asks people to trust.

It is not, once editing truncates. What remains is a question and an answer that genuinely responds
to it — internally consistent, with nothing misleading about the pairing. The lie the plan
imagined belongs to editing _in place_ while keeping the old answer, which is not what shipped.

Keeping the marker would also contradict [ADR 042](042-one-rule-for-destroying-something.md): a
deleted exchange leaves no tombstone, so recording that another was reworded is history the product
has already decided not to keep. Dropping it removed a migration from this slice.

## Two functions, and why they are not one

`deleteTurn` takes one exchange; `deleteFromTurn` takes that exchange and everything after.
They share an anchor lookup and differ only in the upper bound, which made collapsing them
tempting — an integration test asserts them against each other on the same message, 2 rows against
4, so a refactor cannot quietly make them the same thing.

**Positions behave differently between them, which was not obvious.** `appendMessages` takes
`MAX(position) + 1`. Deleting a middle exchange leaves a gap, because a later row still holds a
higher number. Truncating to the end _frees_ the numbers, because the maximum drops — so the
re-asked turn reuses them and lands at 2 and 3 rather than 6 and 7. A test asserted 6 and 7 first;
the database said otherwise, and it was the test that was wrong.

## The id has to be the client's, and that was a bug first

Editing worked once and then failed with "that question was not changed" — reported from real use,
not caught by any test.

`useChat` mints ids in base62; `messages.id` is a `uuid` column filled by `defaultRandom()`. So a
question **asked in the current session** carried an id the database had never seen, and
`removeFromTurn`'s `isUuid` guard refused it before any query ran. Only a full reload, which
re-seeds the transcript from stored rows, made editing or deleting that turn possible. Delete had
the same defect and the same silence.

The fix is to mint the id where the message is created — `crypto.randomUUID()` on the client — and
have the route store it, so one id names the turn on both sides. `appendMessages` takes it only
when it is a uuid, and otherwise falls through to `defaultRandom()`: local mode and any other
caller keep working, and a client sending garbage gets a row rather than an error.

**Why no test caught it.** Every unit test stubs `useChat`, so ids came from fixtures and were
whatever the fixture said. Every integration test called `appendMessages` directly and then read
the ids back out of the database — always uuids. The seam between the two was the only place the
mismatch existed, and nothing crossed it. `e2e/delete-turn.spec.ts` now edits **twice** without a
reload, which fails on the second edit without this fix.

`sendMessage`'s `messageId` option is not this — it names an existing message to replace, and
passing a fresh uuid to it throws "message with id … not found". The id goes on the message.
