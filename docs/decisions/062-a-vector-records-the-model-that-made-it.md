# 062 — A vector records the model that made it

**Status**: proposed, 29 October 2026. Accepted once retrieval enforces it, with the planner
measurement and the backfill counts this record promises below.

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
  count. The server logs those, the first log line this app's server writes, and runs no rewrite,
  because a rewritten question cannot be compared with vectors from another model either.
- **Only the operator repairs it.** A mismatch is either a wrong configuration (1.9.1: fix the
  variable, and re-embedding would destroy good vectors) or stale data (a deliberate change of model:
  re-embed). Only the operator knows which. So the repair is a script, `pnpm db:reembed`, which
  reports by default and rewrites only a named scope; the page offers no action that rewrites data.

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
- **What this record still owes**, filled in when retrieval enforces it: whether the per-document
  filter on the joined `documents.workspace_id` finds the target with iterative scan on, which would
  withdraw the planner argument above and leave the same-row argument standing alone; and the
  backfill's counts on production and Preview.
