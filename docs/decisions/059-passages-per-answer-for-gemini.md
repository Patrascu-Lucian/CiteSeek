# 059 — Passages per answer for Gemini

**Status**: proposed. The method and the rule below are committed before the run they judge, and
before the harness that runs it; the result is added after the run.

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

To be written after the run.
