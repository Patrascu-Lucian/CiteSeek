# 048 — A follow-up local mode can answer, without a generation

## Context

[ADR 044](044-rewriting-a-follow-up-only-after-it-fails.md) added a rewrite for
follow-up questions and excluded local mode from it, for a good reason:

> A rewrite there is a second on-device generation in front of a reader who is
> already waiting on a WebGPU model, and the cost lands exactly where the
> experience is worst.

That reasoning is sound and this does not contradict it. It turns, though, on
_rewrite means a model call_ — true in cloud mode, where a capable model is
already in the request path and nobody would reach for anything cruder.

Found in production, on a real CV rather than a fixture: "did Lucian use React?"
answered, then "for how long?" refused. The refusal even names the cause —
"a short follow-up is the usual cause" — while offering nothing that fixes it.

## Decision

**Retry retrieval with the reader's previous turn prepended, once, and only
after the first attempt returned nothing.**

Retrieval is vector search. It needs _terms_, not grammar, and a grammatical
question is a means to terms rather than the point. `"${earlier} ${question}"`
is not a question and does not need to be.

Measured with `pnpm eval:local-followups` — the local embedder, the product's
floor, the shipped passage count, no provider and no generation:

| query                              | answering passage retrieved |
| ---------------------------------- | --------------------------- |
| the follow-up as asked             | 3/10                        |
| **the previous turn joined to it** | **10/10**                   |
| the standalone question            | 10/10                       |

Joining reaches the standalone ceiling. There is nothing left for a model to add
on this set, which is the argument for not calling one.

## Consequences

**The cost is a second retrieval, not a generation.** One more embedding, and
with it another IndexedDB read and cosine scan, because `retrieveLocally` is
called again rather than re-queried. Milliseconds against the seconds a
generation takes, and bounded by a corpus one person uploaded — but it is a
scan, not just an embedding, and hoisting it would be the optimisation if a
browser corpus ever grew enough to feel it. It lands only on turns that already
failed, so an answered question never waits for it, matching ADR 044's ordering.

**The reader is told what was searched.** The joined text goes out as
`searchedFor` message metadata, the same channel and the same "Searched for"
rendering the cloud path uses. Silently answering a different question than the
one typed is how a reader comes to distrust a citation that is actually correct.

**A first message is left alone.** There is no earlier turn to borrow from, and
inventing one would be the hallucination this project is built to prevent.

**It is not a rewrite, and should not be described as one.** The string handed
to the embedder is two turns concatenated — good for retrieval, meaningless as
prose, and never shown as though the reader wrote it. The screen-reader label is
shared with the cloud path, where a rewrite genuinely is a rephrasing, so it
names the outcome rather than the method: "your question found nothing, so this
searched for".

**The model is given the joined text too, not the bare follow-up.** Retrieval
matched on it, and a bare "how often?" with three passages and no subject is the
input a 0.5B grounds worst. Fixing retrieval alone would move the failure rather
than remove it.

**What this does not fix.** Retrieval was never local mode's weak point: the
answering passage already reached the model 24 times in 24, and grounding is
15/24 ([ADR 047](047-fewer-passages-for-a-smaller-model.md)). This removes a
refusal the reader did not deserve; it does not make the answer that follows any
better.

**Cloud mode is untouched.** It has a model in the path already and ADR 044
measured the rewrite there. Whether concatenation would also serve it — cheaper,
and with no second provider call — is unmeasured and worth asking separately.
