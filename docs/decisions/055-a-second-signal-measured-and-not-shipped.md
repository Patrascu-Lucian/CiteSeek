# 055 — A second signal, measured and not shipped

## Context

[ADR 020](020-measuring-the-relevance-floor.md) found that the relevance floor cannot separate
answerable questions from unanswerable ones on distance alone, and
[ADR 021](021-hybrid-retrieval-measured-and-not-shipped.md) measured hybrid retrieval as the second
signal and watched it lose. Two things were still unmeasured: what the model does with the questions
the floor lets through, and whether a cheaper second signal could tell them apart.

The design that prompted this was a banded floor. The golden set's answerable questions sit at
0.276–0.411 and its ten unanswerable ones at 0.332–0.494, so below 0.332 looked safe to accept
outright, above 0.411 safe to refuse, and a second signal would be needed only between the two — 21
of 51 questions.

## What was measured

Everything against the shipped `0.40` floor and `gemini-embedding-001`.

**What the model does with what the floor lets through** (`pnpm eval:refusals`). Five golden-set
questions clear the floor. Across three runs every reply was a refusal, with no invented content and
no out-of-range marker. Some refusals carried a marker, which the prompt forbids.

**Questions written to sit near the floor.** `UNCOVERED_SET` holds fifteen, each naming something
one document is about and asking for a detail it does not cover, written before any distance was
measured and reported apart from the golden set, because it samples the hard region on purpose. All
fifteen clear the floor. Nine sit below 0.332, and the nearest, at 0.220, is closer than any
answerable question. The model refused all 45 replies across three runs and invented nothing,
including where an inference was on offer: an upgrade rule where only the downgrade is written, a
garden where only the exterior is.

**Two cheap second opinions**, applied to what the floor admits: 40 answerable, 5 golden unanswerable
and 15 uncovered questions. The criterion was fixed before the run: at zero added refusals, remove
more unanswerable questions than tightening the floor does.

| signal                    | answerable refused | golden removed | uncovered removed |
| ------------------------- | ------------------ | -------------- | ----------------- |
| tighten the floor         | 0/40               | 2/5            | 0/15              |
| top lexical rank          | 0/40               | 0/5            | 0/15              |
| margin to the 8th passage | 0/40               | 0/5            | 0/15              |

Lexical rank points the wrong way on the uncovered set: those questions score higher on word overlap
than the answerable ones, a median of 0.40 against 0.20, because naming the topic is what makes them
hard. Every row is in-sample, and the full sweep is in `eval/report.md`.

## Options

**A banded floor**, with a second signal consulted only between the two ranges. Rejected. The band's
lower edge was the lowest of ten distances, and nine of fifteen questions aimed at it fell below it,
so a signal that runs only inside the band never sees most of them.

**A cheap signal over everything the floor admits** — lexical rank or distance margin. Rejected on the
table above: neither beats tightening the floor it would sit behind.

**An entailment gate** — a model call or a cross-encoder asking whether the passages answer the
question. Not built. Every reply to a question that cleared the floor was already a refusal, so a
gate would replace refusals the model writes with ones the route writes. That buys a structural
refusal and removes the markers; it removes no invented answer, because none was measured. It would
also have to run on nearly every admitted question, and a cross-encoder means model weights in a
serverless function, a deployment shape this project has never measured.

**Keep the floor as a filter, and say so.** Chosen.

## Decision

The floor stays at `0.40` and stays the only gate before generation. It is **a filter that removes
irrelevant questions cheaply, not a proof that what passes is answerable**. Past it, the prompt's
refusal rules handle the rest, and the measurements above are the evidence that they do. The
harnesses, both question sets and the signal sweep stay in the tree, run by the evaluation and unused
by the product.

## Consequences

- **The headline guarantee is scoped.** "No answer is generated when nothing clears the floor" is
  structural. "It says so when it doesn't know" is, past the floor, a measured behavior of the
  prompt rather than a property of the route. The README states both.
- **The remaining cost is markers on refusals.** 2 of the golden five and 11 to 13 of the uncovered
  fifteen carry one per run, against the prompt's own rule. Halving that rate needs about 24 leaked
  questions per variant to detect, and the two sets leak 20. Stripping markers from a reply that opens
  with a refusal would be the structural fix, and it is in the backlog.
- **What would reopen this:** a reply that invents an answer to a question the floor let through, a
  corpus where the refusals stop holding, or a reranker that beats the baseline row. Each is one run
  of `pnpm eval:refusals` or `pnpm eval:retrieval`.
- **The claim is scoped like ADR 021's.** Three documents of clean prose, one embedding model, one
  chat model, twenty questions past the floor. A corpus where the model does invent past the floor
  would make a gate worth its call.
