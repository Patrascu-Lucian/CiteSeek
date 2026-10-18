# 059 — Passages per answer for Gemini

**Status**: accepted, 16 October 2026: eight stays. The method and the rule were committed before
the run they judge (#456), and before the harness that ran it (#457).

## Context

Every cloud answer is written from `RETRIEVAL_LIMIT = 8` passages, a number chosen when the
retrieval eval measured recall and nothing measured answers. Its own comment says so: "Gemini is
unmeasured at three and keeps the eight." Local mode measured the question and moved to three: the
0.5B model grounded 15 of 24 answers at three against 13 of 24 at eight
([ADR 047](047-fewer-passages-for-a-smaller-model.md)). Nothing says Gemini behaves the same way,
and nothing says it does not.

## The method

`pnpm eval:answers` asks Gemini the 24 value questions in `ANSWER_SET`, against the three eval
fixtures ingested through the shipped pipeline, retrieved with `retrieveChunks` at each passage
count — floor included, as the chat route does — and answered with the route's prompt, tools and
step limit. Each answer is scored on two outcomes: **grounded** (it states the expected value) and
**cites the answering passage** (a marker the page links points at a passage overlapping the
expected span). Three runs, and a question's result is the majority of the three.

## The rule, fixed before the run

Three replaces eight only if, compared question by question, **no question gets worse on either
outcome and at least one gets better**. A trade — one question better, another worse — keeps eight.
A tie keeps eight. Tokens and passages given are reported but do not decide: the cost of eight
passages is cents a day even at the cap ([ADR 025](025-paying-for-the-model-tier.md)).

The rule is code, `decideDefault` in `lib/rag/eval-metrics.ts`, tested and committed before the
first paid run, so the result cannot choose it.

**A caveat that only cuts one way, stated before the run.** The three fixtures are about 9.8 KB in
all, so eight passages can be a large share of everything there is. In a real workspace more
passages compete for the top three, and recall at three can only be lower there than here. A tie on
this corpus is therefore no evidence for three, which is why a tie keeps eight.

## Result

`eval/answers.md`, three runs over a corpus of 25 passages:

| passages | grounded | cites the answering passage | declined | input tokens (mean) |
| -------- | -------- | --------------------------- | -------- | ------------------- |
| 3        | 23/24    | 22/24                       | 2/24     | 845                 |
| 8        | 23/24    | 23/24                       | 0/24     | 1,213               |
| oracle   | 23/24    | 21/24                       | 3/24     | 601                 |

**Eight stays.** Grounding is identical. On citations three is a trade, not a gain: one question
cites its passage at three and not at eight, and two do at eight and not at three. A trade keeps
the default, and three is the only count with false refusals.

↳ **Amended, 18 October 2026.** The one citation three gained, "How fast is a non-emergency repair
attended?", was cited at eight in all three runs when the chunk-size run asked it again two days
later at the same settings (`eval/answers-chunks.md`). Each session's three runs agreed and the two
sessions disagreed, so that gain was drift between sessions, not three. Without it three only
loses, and eight stays all the more.

**What three loses comes through ADR 058.** Seeing less, the model hedges on questions it can
answer: _"The documents do not cover the total amount to be handed over at the start, though they
state that the deposit is five weeks' rent [1]."_ The value and the citation are right, but the
reply opens in the declining form, so the page unlinks the marker
([ADR 058](058-a-reply-that-declines-links-nothing.md)). Both citations three loses are that shape,
as are all three of the oracle's declines, where the model sees a single passage. At eight the
shape does not occur in this set, so eight also keeps ADR 058's cost off answerable questions.

Three would save about 30% of input tokens. By the rule that does not decide, and at cents a day it
is not worth a false refusal.

One question scores ungrounded at every count for a reason that is the set's, not the model's:
"How much notice do I give to move out?" expects the landlord's two months, and every answer gives
the tenant's one month, correctly. It misses identically everywhere, so it cannot move the
comparison; it is recorded in `docs/backlog.md`.
