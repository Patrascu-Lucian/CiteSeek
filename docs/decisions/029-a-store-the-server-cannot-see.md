# 029 — A store the server cannot see

## Context

Local mode keeps documents in the browser. That is the whole point of it, and it
puts data in a place with properties nothing else in this project has: no region,
no processor, no account, and no server-side deletion path.

The storage choice is nearly forced. `localStorage` is synchronous, string-only
and capped at a few megabytes — an embedding array alone would blow the budget.
The Origin Private File System would work but gives up querying. **IndexedDB** is
the only browser store that holds structured records with indexes at this size.

The interesting decisions are what surrounds it.

## Decision

**Two object stores, mirroring the server's tables.** `documents` keyed by id,
and `chunks` keyed by id with an index on `documentId`. Embeddings live on the
chunk record rather than in a third store, exactly as the `chunks` table carries
its `embedding` column — the closer the shapes stay, the less the citation path
has to care which mode it is in.

Rejected: a separate `embeddings` store, so retrieval could read vectors without
their text. It is the right optimization at a scale this store will not reach —
a document is bounded at 600 chunks by `MAX_CHUNKS_PER_DOCUMENT` — and it buys
that saving with a second key to keep in sync.

**Each document carries its own embedding width.** `EMBEDDING_DIMENSIONS` is 768
because the `vector(768)` column says so; a model small enough to run in a browser
is typically 384. Importing that constant here would hard-code the server's model
into the local path. `putLocalChunks` rejects a vector of the wrong width, because
cosine similarity over mismatched dimensions returns a number rather than an
error — a corpus embedded by two models would rank silently and wrongly.

**Deletion is written out, because IndexedDB has no cascade.** The server gets
`ON DELETE CASCADE` from Postgres. Here, deleting a document without deleting its
chunks leaves the text on the machine that was promised deletion, and nothing
fails. Both deletions run in one transaction.

**"Delete everything" enumerates the database's own stores** rather than a list
written in the function. A store added in a later version would otherwise survive
the control that claims to delete everything, and no test would notice — the
failure mode is a promise quietly narrowing as the schema grows.

**`onupgradeneeded` has no `contains` guards.** At version 1 it fires only for a
database that does not exist, so the guards were branches nothing could reach.
Version 2 needs `oldVersion` branching, which is migration logic to write then.

## Consequences

**The privacy page changed in this commit, not after it.** Three claims stopped
being true the moment this store existed: that deleting an account "deletes
everything", that everything is hosted in the EU, and the implication that the
processor list covers every place a document goes. The page now states the
exception, and its pinning test covers all three. This is Milestone 6's rule and
ADR 025's, and this store is a sharper case than either — a deletion promise with
an unstated exception is worse than no promise.

**Two things are said plainly because a reader will not derive them.** This
storage belongs to the **browser profile, not the account**: signing out does not
clear it, and anyone else using the same browser on the same computer can read it.
And **account deletion cannot reach it**, because the deletion runs on a server
this data never touched.

**The delete control sits outside the WebGPU gate.** Losing WebGPU — a flag
switched off, a driver change — must not strand a reader with documents and no
visible way to remove them. A deletion control behind a capability check is
missing exactly when the capability is.

**The error message renders inside the dialog.** Radix marks the page behind an
open dialog `aria-hidden`, so an error placed on the page is unreadable precisely
while the dialog that caused it is open. The dialog stays open on failure on
purpose; the message has to be somewhere the reader still is.

**`lib/local/**` joins `lib/rag/**` and `lib/ai/**` at the 90% coverage
threshold.** The store is I/O, but it is I/O against an engine that runs in Node
under `fake-indexeddb`, so the unit layer can hold it to the same bar as the pure
core — including the delete-everything test, which is the local half of the
cascade test the server has.
