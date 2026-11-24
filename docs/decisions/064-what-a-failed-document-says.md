# 064 — What a failed document says

**Status**: accepted, 24 November 2026.

## Context

A document that failed to process showed the reader its row's `documents.error`. That column holds
`sanitizeError(error)`: the exception's message with its whitespace collapsed and its length capped.
So a reader could meet an environment variable's name, a provider's quota text or a parser's
complaint under their own filename. Beside it sat a Retry the list offered on every failed row,
though the retry route refuses when no text was kept (409, "unrecoverable"), and when text was kept
but no passage was, it answers 202 and then does nothing.

Three responses carried the message to the browser: the polled list, the list the workspace layout
renders on the server, and the single-document route. Readers who are not me now have documents in
production, so this is what they meet when an upload fails.

## Options

- **Write reader copy into `error` when the document fails.** No new column, but the copy becomes
  data: a rewording never reaches old rows, a test cannot tell one failure from another, and Retry
  still has to be decided some other way.
- **Classify the stored message when the list is read.** No change on the write side, and every rule
  is a guess about an exception's wording, which an SDK update can change.
- **A reason chosen when the document fails, by the error's type or the phase it came from.**
  Chosen.

## Decision

- **Each failure records a reason** in `documents.failure_reason`, chosen by the error's type or the
  phase it came from, never by its message. Local mode already classifies this way (`describe()` in
  `lib/local/ingest.ts`).

  | Source                                                                   | Reason                  | Retry       |
  | ------------------------------------------------------------------------ | ----------------------- | ----------- |
  | Nothing extractable: a scan, an empty file, no text after chunking       | `no_text`               | never       |
  | Damaged, protected, an old `.doc`, not UTF-8, an unsupported type        | `unreadable`            | never       |
  | Over the passage ceiling                                                 | `too_large`             | never       |
  | Over the workspace's storage ceiling                                     | `over_storage`          | never       |
  | The embedding phase: the provider, a quota, the network, a partial batch | `embedding_unavailable` | yes         |
  | The stale-processing watchdog                                            | `interrupted`           | by the rule |
  | Anything else                                                            | `unknown`               | by the rule |

  A scan keeps a reason of its own because it is the one failure with advice that works: run OCR on
  it first.

- **Each reason's sentence lives in one table**, typed so that a new reason does not compile without
  one.
- **Retry is decided by one function.** The list calls it to decide whether to offer Retry, and the
  retry route calls it to decide whether to accept one. It requires stored text and at least one
  stored passage, so the 202 that did nothing is refused too. The four reasons marked "never" are
  all thrown before the text is stored, so the rule never offers them.
- **The sanitized message stays on the row for diagnosis.** No response the browser receives carries
  it.
- **A text column, as `refusal_reason` is**: widening the union needs no migration, and nothing in
  SQL branches on it. A reason is read only while `status` is `failed`, and a null one reads as
  `unknown`.
- **No CHECK.** After a rollback, 1.13.1 never clears the column, and a stale reason must not fail
  its writes.

## Consequences

- **Documents that failed before this read as `unknown`**, with Retry where the rule allows. Their
  stored messages stay; a backfill happens only if counting them shows readers' rows worth one.
- **A failure recorded between migrating and deploying has no reason either**, and reads the same
  way.
- **A new failure source needs its own reason**, or it lands in `unknown`, which is honest and less
  useful.
