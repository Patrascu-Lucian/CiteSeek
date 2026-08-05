# 021 — Hybrid retrieval, measured and not shipped

## Context

[ADR 020](020-measuring-the-relevance-floor.md) ended by pointing here. The
relevance floor cannot separate answerable questions from unanswerable ones on
cosine distance alone — the distributions overlap — so the argument was that
closing that gap needs a **second signal** rather than a better constant.

Hybrid retrieval is the standard second signal, and the backlog had carried it
since Milestone 2 with a sound-sounding rationale: embeddings match meaning and
are weakest on the terms a reader types verbatim — a product code, an error
string, a name. That rationale was never tested.

## What was built

- A GIN index on `to_tsvector('english', content)`, as an **expression** index so
  nothing is backfilled and the offsets citations depend on are untouched
  (migration 0006).
- `lib/rag/lexical.ts` — `ts_rank_cd` over that index, workspace-scoped in SQL
  like the vector path.
- `lib/rag/fusion.ts` — reciprocal rank fusion. Positions rather than scores,
  because a cosine distance and a `ts_rank_cd` are not the same kind of number
  and normalizing them invents a comparison the numbers do not support.
- Six **term-heavy questions** added to the golden set (`E04`, `ISO VG 46`, `M16`,
  `Severity 2`, `HL-90`, `clause 7`). The existing 35 were deliberately phrased
  away from the documents' words, which is right for testing a vector search and
  makes it impossible to see what lexical search is _for_.

## What was measured

`pnpm eval:retrieval`, 51 questions, one ingest, every strategy over the same
retrievals. The weight is the lexical list's, against a vector weight of 1, so
**hybrid 0 is vector alone** on the same sweep rather than beside it.

| strategy                    | recall@1 | recall@3 | MRR      |
| --------------------------- | -------- | -------- | -------- |
| lexical alone               | 0.39     | 0.66     | 0.53     |
| **hybrid 0 (vector alone)** | **0.67** | **0.95** | **0.82** |
| hybrid 0.25                 | 0.65     | 0.85     | 0.79     |
| hybrid 0.5                  | 0.60     | 0.85     | 0.77     |
| hybrid 0.75                 | 0.61     | 0.85     | 0.77     |
| hybrid 1.0                  | 0.61     | 0.85     | 0.77     |

Every blend is worse than vector alone, and it degrades as the lexical list is
given more say. There is no weight that wins.

## Decision

**Do not wire hybrid retrieval into the answer path.** Keep the index, the two
modules and the golden-set additions, unused by the product and exercised by the
evaluation.

The reasoning that survived contact with a measurement: `gemini-embedding-001`
already handles the term-heavy questions this was supposed to rescue — it scores
0.95 recall@3 _including_ the six new ones. Fusing a weaker list into a stronger
one costs rank, and RRF has no mechanism to notice that one input is worse.

## Consequences

**An unused index and two unused modules stay in the tree**, which is a real cost
and a deliberate one. Re-measuring is one command; deleting this means a migration
each way and re-deriving the result. Ingestion is dominated by the embedding API
call — 1.8 s for a 51-page PDF — so a GIN insert alongside it is not measurable.

**The claim is scoped, not universal.** Three documents of clean prose, around
fifty chunks, one embedding model. Lexical search earns its place on large
corpora full of rare identifiers, and nothing here refutes that. What it does
refute is adding it _to this corpus_ on the strength of the argument alone.

**The floor gap from ADR 020 is still open.** Hybrid was the candidate and it
lost, so the remaining options are a reranker over the top k, or accepting that
the floor is a filter and saying so plainly — which the README now does.

**The golden set is better for having been wrong.** Its questions were biased
against lexical search by construction, and the first measurement read as
"lexical does not help" when it meant "these questions cannot show whether it
does". A set that can only confirm the design it was written alongside is not an
evaluation.
