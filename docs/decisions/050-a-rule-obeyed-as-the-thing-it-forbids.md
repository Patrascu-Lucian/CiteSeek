# 050 — A rule about markers, obeyed as the thing it forbids

## Context

Local mode cites nothing: **0 of 24** ([ADR 046](046-the-pin-survives-the-search.md)).
[ADR 049](049-what-asking-a-small-model-to-cite-costs.md) showed that removing the
citation instruction changes nothing, and named the open question — whether a
_better_ instruction would work.

The failure has a shape. When a marker does appear it stands where the value
belongs: "The oil needs changing every [1] years" for 2,000 operating hours,
which reads as "1 year"
([ADR 038](038-a-citation-that-cannot-be-read-as-content.md)). The worked example
demonstrates a **sentence** with a trailing marker, so it never shows what to do
with a number.

So: add one line saying where a marker goes relative to a value, and measure it.

## Decision

**Do not add it.** It buys one citation in twenty-four, and the citations it
produces are the form the line forbids.

Four configurations, one scorer, the shipping passage count:

| prompt                               | grounded | cited    |
| ------------------------------------ | -------- | -------- |
| shipped                              | 15/24    | 0/24     |
| \+ placement line                    | 15/24    | **1/24** |
| \+ placement line quoting a specimen | 15/24    | **1/24** |

Grounding does not move at all. What moves is one citation, inside the row-level
churn this model shows on any prompt change — ADR 049 measured five rows moving
for a net of one.

**The citations are the failure the line was written to prevent.** The report
keeps transcripts for the oracle rather than per-count, so those are what can be
read:

- `The oil needs changing every [1] operating hours or annually.` — the marker
  consumed "2,000".
- `For storage over three months, [1]` — the marker replaced the answer.
- `30 days [1]` — well formed, wrong value; the passage says 30 _minutes_.
- `90 days [1]` — correct, and exactly what the line asked for.

One of six is what was asked for. The line says "never in place of a word or a
number", and the model writes markers in place of words and numbers **while being
told not to**. That is not an instruction that failed to arrive; it is one that
arrived and constrained nothing.

## What went wrong in measuring it

The first version of this ADR concluded the citations were _copied_ rather than
followed, on the evidence that removing a quoted specimen removed them. Both
halves were artifacts.

**The rule was joined with one newline** where every other section uses two, so it
rendered as a third line of the worked example rather than a rule of its own. In
that state the model returned the rule verbatim as an answer, and the
specimen-free variant scored zero. With the blank line restored neither happens.

**The baseline was graded by a different scorer.** `eval/local-answers.md`
predated the trailing word-boundary guard in `grounds`, and was compared against
runs made after it. Re-running under one scorer moved the **oracle** column from
17/24 to 16/24 — `"5 bars"` no longer matches a want of `"5 bar"` — while the
three- and eight-passage columns held.

Recorded because the lesson is not about prompts: **a formatting defect and a
scorer change each produced a plausible finding, and one of them was the
finding.**

## Consequences

**The prompt is unchanged.** The line lives behind `--placement`, with
`--placement-specimen` for the quoted form, both defaulting off, for asking this
of a larger model. The specimen is a flag rather than a source edit because the
first attempt at this comparison could not be reproduced.

**The oracle figure of 17/24 was inflated** and reads 16/24 now wherever it
appears. The grounding comparisons in
[ADR 046](046-the-pin-survives-the-search.md) and
[ADR 047](047-fewer-passages-for-a-smaller-model.md) stand: they use the three-
and eight-passage columns, which did not move.

**What is left is constrained decoding** — backlog step 4, and the only remaining
option that does not depend on the model choosing to comply. Three prompt-level
attempts have now failed in three different ways, which is the argument for it.
