# 030 — Parsing local documents on the main thread

## Context

Local mode parses uploads in the browser: `extract.ts` → `chunking.ts`, the same
modules the server runs, which is what keeps a local citation resolvable by the
same offsets as a cloud one.

The obvious place for that is a Web Worker. Parsing is synchronous and CPU-bound,
and the main thread is where scrolling and buttons live.

## Options

**A Web Worker.** Built first, and it works for Word, Markdown and plain text.
**It does not work for PDF**: `unpdf` inside a worker neither resolves nor throws.
The worker loads every chunk it needs — all requests 200 — receives the file, and
then stops. No console output, no `error` event, and an `unhandledrejection`
listener in the worker never fires. The upload waits forever.

Ruled out along the way: it fails identically under `pnpm dev`, which carries
`'unsafe-eval'`, so the CSP relaxation in [ADR
028](028-relaxing-the-policy-for-one-route.md) is not the cause. Word documents
parse in the same worker, so the worker itself is sound. The failure is `unpdf`
in a worker specifically, most likely PDF.js's own nested worker never settling.

**The main thread.** Parses every supported format, including PDF.

## Decision

**Parse on the main thread**, and delete the worker rather than keep it for the
formats it happens to handle. A parser that works for three of four formats is a
branch that has to be chosen at runtime by file type — more surface, and the PDF
path would still be broken.

**The measurement is what makes this comfortable rather than a concession.**
Upload to rendered result, in Chromium:

| Document                                              | Passages | Elapsed |
| ----------------------------------------------------- | -------- | ------- |
| `sample.pdf`, 2 pages, 943 B                          | 1        | ~0.40 s |
| `northwind-remote-work-handbook.pdf`, 51 pages, 68 KB | 10       | ~0.43 s |

A 51-page document costs the same as a 2-page one, so the time is the one-off
`import("unpdf")`, not parsing. The worker was guarding against a stall that does
not exist at this size.

## Consequences

**This is not a decision about the embedder.** Embedding runs transformers.js over
every passage — seconds of sustained WASM, which genuinely must leave the main
thread. That worker has no PDF.js in it, so this finding does not bind it. Revisit
the parse thread only if a document is found that measurably janks the page.

**`worker-src 'self' blob:` in ADR 028 now has no consumer.** It stays: the
embedder needs it in the next slice, and removing a directive to add it back is
churn. If local generation is ever abandoned, that directive goes with it.

**The hang left no trace, which is the part worth remembering.** Every signal was
green — 200s on all requests, an empty console, no rejection — and the only way to
see the failure was that nothing happened. `parseFile` returns a typed failure for
anything that throws, but a promise that never settles cannot be caught. If a
parser is ever moved off the main thread again, it needs a timeout, because
"waits forever" is the failure mode this class of bug produces.
