# 062 — A vector records the model that made it

**Status**: accepted, 9 November 2026, once retrieval read only the configured model's vectors
and the route refused a mismatch by name. Proposed 29 October 2026; what it promised to measure
is under **Measured**, below.

## Context

A stored vector only means something beside a query vector from the same model. Fake vectors and
Gemini's have the same width, 768, so pgvector compares them without complaint, and nothing in a
`chunks` row says which model produced its `embedding`. Retrieval has met that gap twice, from both
directions:

- **Fake data under a real configuration.** The seed once embedded production's demo document with
  the fake embedder, and every question was refused as "nothing relevant"
  (`docs/code-review-notes.md`, "The demo went silent because config and data came from different
  machines"). The fix guards the seed: `assertEmbedderWasChosen` refuses fake vectors on a remote
  host unless the fake was exported deliberately.
- **Real data under a fake configuration.** The 1.9.1 smoke test ran Preview with
  `EMBEDDINGS_PROVIDER=fake` against passages Gemini had embedded. Fake query vectors landed far from
  every passage, every question fell below the floor, the reader saw the same refusal, and nothing
  logged it. It took four diagnostic steps to find (`docs/backlog.md`, "What the 1.9.1 smoke test
  found").

Each guard so far was shaped like the route its incident arrived by, and the next incident arrived by
another. Both are one missing fact, which model embedded the vectors being compared.

The relevance floor has the same gap. It belongs to the embedding model (ADR 020), but
`retrieveChunks` reads it from the _configured_ provider at query time
(`maxDistanceFor(resolveEmbeddingsProvider())`), so it is the right floor only while every stored
vector came from that provider. During any change of provider or model it is silently wrong.

## Options

- **Record the model on each chunk.** The record sits in the same row as the vector, so it can be
  written in the same statement and, later, required by a `CHECK` on that row. Retrieval filters on it
  beside `workspace_id`, in the scan [ADR 026](026-scoping-chunks-by-workspace.md) shaped.
- **Record it on each document.** One value per document reads naturally, since ingestion embeds a
  document with one model. But the retry route resumes a document with whatever model is configured
  _now_, so one document can hold vectors from two models, and a per-document record cannot say so.
  The filter would also sit on a joined table, the shape ADR 026 measured finding 0 of 1 under an
  HNSW-first plan without iterative scan; this record measures it with iterative scan on (below).
- **Fingerprint stored vectors at query time.** Fake vectors are word counts over a positive norm,
  so never negative and mostly zero; Gemini's measured about 399 negative components of 768 and no
  zeros. No migration, but a heuristic guarding a guarantee, and it fails on the first model whose
  vectors look like either.
- **Check at startup.** Serverless has no single startup, and one sampled vector cannot see a
  workspace that holds both kinds, which is exactly the state a provider change passes through.
- **Check stored data at build time.** It would have stopped 1.9.1 at deploy, but it makes a data
  condition fail unrelated deploys. Not chosen; parked in the backlog.

## Decision

**Each chunk records the model that embedded it, and retrieval reads only the configured model's
chunks.**

- **The record** is `chunks.embedding_model`, `text`, written in the same `UPDATE` as the vector. It
  holds the model id: `gemini-embedding-001` or `fake`. A successor to the pinned model is a different
  vector space, so it has to read as a mismatch, which a provider name would not. No index: a
  workspace holds one or two distinct values, so the column rides the HNSW scan as a filter.
- **It is never `NOT NULL`.** Chunks are inserted before they are embedded, so a null model is right
  for a null vector. The rule is `(embedding IS NULL) = (embedding_model IS NULL)`, enforced in code
  first and as a `CHECK` one release later: `vercel.json` runs `db:check` before every build, so a
  migration is applied before its deploy, and a `CHECK` applied while the previous release still
  writes unlabeled vectors would fail its uploads.
- **Existing rows are classified once**, in the migration that adds the column, by the fingerprint
  above. A row is labeled only when both features agree (negative components and no zeros for Gemini;
  no negatives and some zeros for the fake). Any other row stays unlabeled: unsearchable and
  repairable, never guessed. The fingerprint is used for this one backfill and nowhere at query time.
- **The floor follows the filter.** `retrieveChunks` resolves the provider once and derives both the
  model it filters by and the floor it applies from that value, so the floor is by construction the
  floor of the vectors compared.
- **A mismatch is refused by name.** When a workspace has embedded chunks and none from the
  configured model, the refusal reason is `embedding_model_mismatch`, not `no_relevant_passages`.
  Both alternatives would be false: nothing was compared, so nothing "matched" or failed to, and the
  documents are `ready`, so they are not missing. The reader's copy names no provider, model or
  count. The server logs those, in a line that names no workspace (the request path beside it in
  the platform's log already does), and runs no rewrite, because a rewritten question cannot be
  compared with vectors from another model either.
- **Only the operator repairs it.** A mismatch is either a wrong configuration (1.9.1: fix the
  variable, and re-embedding would destroy good vectors) or stale data (a deliberate change of model:
  re-embed). Only the operator knows which. So the repair is a script, `pnpm db:reembed`, which
  reports by default and rewrites only a named scope; the page offers no action that rewrites data.

↳ **Amended, 11 November 2026.** `--apply` re-embeds in place: it selects the vectors the configured
model did not write, embeds them, and writes each over the old one with its label, a batch at a
time, leaving document status alone. It used to discard them first and resume, and a provider
failure then left a `failed` document with no vectors, which the next run's report, reading stored
vectors only, could not see. Now a failure loses nothing and the same command continues.

## Consequences

- **A change of provider or model is "switch, then re-embed".** Until a document is re-embedded it is
  refused by name rather than searched wrongly. Switching first means uploads made during the change
  land under the new model and need no second pass.
- **A zero-downtime change** would need two vectors per chunk. It is not built, and no change is
  planned.
- **Retry keeps its meaning.** It fills null vectors with the configured model; a document whose
  chunks span two models is safe, because each chunk is compared only within its own.
- **After the `CHECK` ships, rolling back below this release** means dropping the constraint first.
- **Local mode is unaffected.** Its store holds one model and already checks each vector's width
  against its document's.

## Measured

**The per-document option's planner argument is withdrawn.** In ADR 026's forced-plan harness, the
filter on the joined `documents.workspace_id` with iterative scan on found the target in 3 of 3
runs; with the scan off it found 0 of 1, as ADR 026 recorded. The scan keeps walking until enough
rows survive the join, so the planner never ruled that option out at this scale. The decision rests
on the same-row argument alone: a record in the vector's own row can be written in the same
statement and required by a `CHECK` on that row. The model filter does need the scan, exactly as the
workspace filter does: 60 nearer rows from another model in the same workspace leave the target
unfound without it, and the forced-plan test now covers both.

**The backfill was counted read-only before it ran, then rehearsed on a Neon branch of each
database:**

| Database   | Gemini | Fake | Disagreeing | Fewest negatives in a Gemini vector | Rehearsal                           |
| ---------- | ------ | ---- | ----------- | ----------------------------------- | ----------------------------------- |
| Production | 500    | 0    | 0           | 350 of 768                          | 2.7 s end to end; every row labeled |
| Preview    | 24     | 0    | 0           | 356 of 768                          | 2.1 s end to end; every row labeled |

No row fell between the two shapes, and the closest Gemini vector still had 350 negative
components. Preview held no fake rows at all: the 1.9.1 smoke test only queried with fake vectors
and wrote none.
