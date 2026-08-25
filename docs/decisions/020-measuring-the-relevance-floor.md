# 020 — Measuring the relevance floor

## Context

[ADR 011](011-retrieval-and-citation-strategy.md) makes the project's strongest
claim: when nothing retrieved clears a distance threshold, the model is never
called, so a refusal cannot cite. That claim is about the _refusal branch_, and it
holds — no generation step runs there, so there is nothing to invent a citation
into.

↳ **Amended, 25 August 2026.** "No generation step runs there" stopped being literally true
when [ADR 044](044-rewriting-a-follow-up-only-after-it-fails.md) put a rewrite on that branch.
The claim it was making survives: no _answer_ is generated, so there is still no prose for a
citation to hide in. The rewrite's output is a search query, shown to the reader as one.

What was never established is how often that branch is taken when it should be.
`MAX_DISTANCE` shipped at `0.6` for `gemini-embedding-001` and the code said so
plainly: _"Provisional — needs tuning against real documents, which is the one
thing no test here can do for us."_ The E2E suite exercises the refusal path with
the fake embedder, whose numeric range is unrelated, so it proves the wiring and
nothing about the threshold.

## What was measured

`pnpm eval:retrieval` — three documents written for the purpose, 45 questions
phrased against what the documents mean rather than from their headings, of which
10 are answerable by none of them. Expected passages are recorded as quotes and
resolved to character ranges at run time, so re-chunking moves the mapping rather
than invalidating it.

**Ranking is good.** Recall@3 is 0.97 and recall@8 is 1.00, with an MRR of 0.84 —
the passage that answers the question is nearly always retrieved, and usually
first. Precision falls with k as it must when one passage answers the question.

**The floor is not.** The closest chunk per question:

|              | min   | median | max   |
| ------------ | ----- | ------ | ----- |
| answerable   | 0.284 | 0.325  | 0.411 |
| unanswerable | 0.332 | 0.422  | 0.494 |

The ranges **overlap between 0.332 and 0.411**. Every threshold is a trade:

| max distance   | false refusals | false accepts |
| -------------- | -------------- | ------------- |
| 0.35           | 8/35           | 3/10          |
| 0.40           | 1/35           | 5/10          |
| 0.45           | 0/35           | 7/10          |
| 0.60 (shipped) | 0/35           | 10/10         |

At `0.6` the floor admits everything. _"What is the capital of Portugal?"_ clears
it against a tenancy agreement.

## Decision

**Move `MAX_DISTANCE` for `gemini-embedding-001` from `0.6` to `0.40`**, and stop
describing the floor as a guarantee about _answers_.

`0.40` is where the trade is the least bad on this corpus: one answerable question in
35 refused, against half the unanswerable ones caught. `0.45` refuses nothing
correct but catches almost nothing; `0.35` starts rejecting real questions faster
than it gains.

## Consequences

**The floor is a filter, not a proof.** Half the ungrounded questions still reach
the model at `0.40`. What ADR 011 guarantees is unchanged — a refusal cannot cite,
because no model runs on that branch — but the branch is taken less often than the
prose implied. The README and About page are corrected accordingly: the model is
never called _when the floor refuses_, which is a narrower sentence than "when
nothing relevant is found".

**Tuning cannot close this.** The distributions overlap, so no threshold
separates them. That is an argument for a better _signal_ rather than a better
number, and it turns two parked backlog items — hybrid keyword search and
reranking — from opinion into evidence. The next honest improvement is measured
against this same set.

**The number is now falsifiable.** `eval/report.md` records the run, and the
harness refuses to run with the fake embedder, so nobody can regenerate a
flattering version of it by accident.

**The sample is small and its own corpus.** Ten unanswerable questions over three
documents is enough to show `0.6` is wrong and not enough to call `0.40` optimal.
Real documents with real questions would move it, and the harness exists so that
is a measurement rather than an argument.
