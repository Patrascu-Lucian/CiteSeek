# 038 — A citation that cannot be read as content

## Context

Asked "How many days of annual leave do employees get?", the local model answered:

> Employees receive **1** days of annual leave.

That `1` was a working citation chip. Clicking it opened the passage, which reads _"Annual leave
is 28 days plus public holidays"_. The model had written `Employees receive [1] days of annual
leave` — putting the marker where the quantity belonged — and because a chip rendered as a bare
numeral inline, the sentence read as an answer with a number in it.

The only thing giving it away was the grammar: **"1 days"**.

**Every guard held and none of them fired.** The marker resolved, so
[ADR 036](036-saying-why-a-citation-did-not-link.md) had nothing to report. Something was
cited, so [ADR 037](037-an-answer-that-cites-nothing.md) stayed quiet. The chip opened the
passage it named, which is all `linkCitationMarkers` ever promised. Every one of them was
correct, and the answer was still wrong in a way the reader could not see.

## Decision

**Render the marker bracketed — `[1]` — rather than as a bare number.**

A citation is inline in prose, so it has to be unreadable as part of the sentence. A bare
numeral is readable as part of the sentence anywhere a number could sit, which is not a rare
position: quantities, dates, durations, counts. Brackets cannot be read as a quantity.

They are also what the model was asked to produce — rule 2 of the system prompt says to cite
inline as `[1]` — so the chip now shows what the model actually wrote instead of a cleaned-up
version of it.

The pill stays, with `rounded-md` and a wider minimum: [ADR 023](023-one-accent-and-it-belongs-to-the-citation.md)'s
reason for it is unchanged — the accent belongs to the citation and its highlight, and a
selected chip still carries `--primary`.

## Consequences

**Copying an answer improves as a side effect.** `lib/ai/citations.ts` already separates
adjacent markers with a space because two chips copied as text flattened into `35`, "a marker
that cannot exist". With brackets they copy as `[3] [5]`, which is unambiguous without relying
on the separator.

**This is a rendering fix for a model problem, and it does not solve the model problem.** The
answer is still wrong: the document says 28 and the model did not say so. What changes is that
the sentence no longer _looks_ like it contains an answer. A reader now sees "Employees receive
[1] days", which reads as a citation attached to an incomplete claim — visibly odd rather than
quietly false.

**The underlying gap is untouched and stays in `docs/backlog.md`.** A marker that resolves
proves the passage was retrieved, not that it supports the sentence attached to it. This case
was a sharper edge of that — the marker was mistaken for the content rather than merely
trusted — and closing the general case still needs an entailment check rather than a
presentation change.
