# 026 — Scoping chunks by workspace, and why the column was not the fix

## Context

`chunks` carried no `workspace_id`. Scope was derivable through `documents`, so
`retrieveChunks` filtered on `eq(documents.workspaceId, …)` — a **joined** table —
inside the subquery the HNSW index is meant to accelerate.

That gives Postgres two plans and both degrade:

- **Join-first** is exact and computes a cosine distance for every chunk in the
  tenant's corpus.
- **HNSW-first** returns the globally nearest `ef_search` rows (default 40) and the
  join discards the foreign ones _afterward_. A small tenant in a large table gets
  back fewer than `limit` rows, and sometimes none.

The second is the dangerous one, because under-retrieval is not visible as an error.
Fewer passages clear the relevance floor, the model refuses a question the documents
answer, and **the failure looks exactly like the product working correctly** —
[ADR 017](017-answering-questions-the-documents-cannot-answer.md) is the behavior it
hides behind.

## What was measured

The bug does not reproduce by row count at any size worth testing. At 400 rows the
planner filtered on `workspace_id` and sorted, which is exact — and `enable_seqscan =
off` did not change that, because it used the btree index and sorted. **`enable_sort =
off` is what forces the ordering to come from the vector index**, which is the plan a
large table produces on its own.

Under that plan, 60 foreign chunks nearer to the query than the target, `ef_search = 10`:

| query shape                                | HNSW used | target found |
| ------------------------------------------ | --------- | ------------ |
| filter on `documents` (before)             | yes       | **0 of 1**   |
| filter on `chunks`, no iterative scan      | yes       | **0 of 1**   |
| filter on `chunks` + `hnsw.iterative_scan` | yes       | **1 of 1**   |

400 foreign chunks behaves identically.

## Decision

**Denormalize `workspace_id` onto `chunks`, and enable `hnsw.iterative_scan =
relaxed_order` on the retrieval transaction.** Both, because the middle row above is
the whole point: moving the predicate onto the same table fixes nothing on its own.

An approximate index does not evaluate predicates — it walks its graph outward from
the query point and returns what it finds. Iterative scan makes it keep walking until
`limit` rows pass the filter, and that requires the filter to be on the indexed table.
The column is what makes the mechanism available; the GUC is what uses it.

`relaxed_order` rather than `strict_order`: it can return rows slightly out of
distance order, and the outer query already re-sorts, so the approximation costs
nothing here. That outer sort was written for an unrelated reason and paid for itself.

## Consequences

**This is denormalization.** `chunks.workspace_id` can disagree with its document's.
`ON DELETE CASCADE` covers deletion, and nothing in the app moves a document between
workspaces — if anything ever does, it has to write both. The alternative, deriving
scope through the join, is what this ADR exists to reject.

**The join stays**, for `documents.filename`. Only the predicate moved.

**`lib/rag/lexical.ts` moved with it** although nothing forced it to: a GIN index
filters exactly, so lexical search never had this bug. Two retrieval paths disagreeing
about where tenancy lives is how the next one gets it wrong.

**The regression test forces its own plan**, which is unusual and deliberate. A test
that waits for the planner to choose HNSW would need a corpus too large to seed, so it
asserts the conditional instead: given this plan, the result must still be correct.
It fails without the fix, returning an empty list — the silent-refusal shape.

**The join-first plan is still O(corpus).** This removes the plan that returns wrong
answers, not the one that is merely slow. That is a separate problem and not yet one:
`pnpm eval:retrieval` is unchanged by this.

**Migration 0007 was hand-edited.** `drizzle-kit generate` emitted a single
`ADD COLUMN … NOT NULL`, which fails on a populated table. Split into add-nullable,
backfill from `documents`, then `SET NOT NULL`.
