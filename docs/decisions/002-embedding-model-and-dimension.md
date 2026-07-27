# 002 — Gemini embeddings at 768 dimensions

**Status**: accepted · **Date**: 2026-07-27 · **Milestone**: 0 (Slice 2), consumed by Milestone 1

## Context

`chunks.embedding` needs a fixed dimension before the table can be created — pgvector
declares dimensionality on the column, and the ANN index inherits it. Getting this wrong
is expensive: changing it later means re-embedding every document.

Two constraints collided:

1. **pgvector's HNSW and IVFFlat indexes cap the `vector` type at 2,000 dimensions.**
   The base `vector` type accepts up to 16,000, so an oversized column _creates fine_ and
   only fails when you try to index it — i.e. at the moment retrieval starts to matter,
   not at migration time.
2. **Gemini's embedding model outputs 3,072 dimensions by default** — above that cap.

The naive path (take the default) produces a column that works in `pnpm db:migrate`,
works in a seed script, and silently degrades to a sequential scan on every query.

## Options considered

1. **Gemini embeddings, dimension-reduced** — the model uses Matryoshka Representation
   Learning, so `outputDimensionality` can be set to a smaller supported size (128–3072;
   768 / 1536 / 3072 recommended) with modest quality loss.
2. **Local embeddings via transformers.js** (`all-MiniLM-L6-v2`, 384d) — free, no quota,
   nothing leaves the server, deterministic output.
3. **Full 3,072 stored as `halfvec`** — HNSW supports `halfvec` up to 4,000 dimensions.

## Decision

Option 1, at **768 dimensions**.

- Comfortably under the 2,000 index cap, with room to move to 1,536 later if retrieval
  quality proves insufficient.
- One quarter the storage and index size of the 3,072 default.
- Embeddings are included in Gemini's free tier, on a quota separate from chat — which
  matters because ingestion is the bursty half of the workload. A 50-page PDF is roughly
  300 chunks, so ingestion generates ~300 embedding calls where a chat turn generates one.

Option 2 was genuinely attractive — free, unlimited, and deterministic output would let
`lib/rag` be unit-tested without mocking an API. It was set aside because running the ONNX
runtime on Vercel's serverless functions brings cold-start and bundle-size problems that
would need solving inside Milestone 1, and Milestone 1's real work is chunking and
retrieval quality. It stays on the table as the Milestone 6 local-mode path, where it is
the point rather than an optimization.

Option 3 solves the wrong problem: it preserves dimensions we have no evidence we need.

## Consequences

- `chunks.embedding` is `vector(768)`. This is now a hard dependency of the schema — a
  change means a migration _and_ a full re-embed.
- **MRL-truncated vectors likely need re-normalizing** before storage. Verify this at
  implementation time in Milestone 1; getting it wrong degrades cosine similarity quietly
  rather than loudly.
- Gemini's free tier states that content is used to improve Google's products. For a
  product whose entire premise is "upload your documents", this is a disclosure obligation,
  not a footnote — the upload UI must say so plainly. It is also the honest justification
  for Milestone 6's local mode.
- Retrieval quality at 768d is an assumption, not a measurement. Milestone 1 should record
  a before/after if the dimension is ever revisited.
