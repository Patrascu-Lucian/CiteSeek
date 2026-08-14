# 038 — A citation that can be read as content

## Context

Asked "How many days of annual leave do employees get?", the local model answered:

> Employees receive **1** days of annual leave.

That `1` was a working citation chip. Clicking it opened the passage, which reads _"Annual leave
is 28 days plus public holidays"_. The model had written `Employees receive [1] days of annual
leave` — putting the marker where the quantity belonged — and because a chip renders as a bare
numeral inline, the sentence read as an answer with a number in it.

The only thing giving it away was the grammar: **"1 days"**.

**Every guard held and none of them fired.** The marker resolved, so
[ADR 036](036-saying-why-a-citation-did-not-link.md) had nothing to report. Something was
cited, so [ADR 037](037-an-answer-that-cites-nothing.md) stayed quiet. The chip opened the
passage it named, which is all `linkCitationMarkers` ever promised. Every one of them was
correct, and the answer was still wrong in a way a reader could miss.

## Decision

**Keep the bare number in its pill.** The ring and background are what mark it as a control;
inside one, brackets read as punctuation that escaped the renderer.

Bracketed markers — `[1]` — were built and tried first, on the reasoning above. Seeing them in
place settled it against them: the pill already carries the distinction the brackets were meant
to add, and doubling it looked like a bug rather than a citation. That is a judgement about
appearance, and appearance is the thing the reader actually meets.

## Consequences

**The original failure is mitigated but not removed.** "Employees receive `1` days" still reads
as a sentence with a number in it if the pill is skimmed past. What defends against it now is
the pill's own styling and the grammar — the model must write something the sentence cannot
absorb for the reader to notice. That is weaker than brackets and it is the accepted cost.

**Copied text stays ambiguous.** `lib/ai/citations.ts` separates adjacent markers with a space
because two chips copied as text flattened into `35`, "a marker that cannot exist". That
separator is still doing the work; brackets would have made it unnecessary. Copying an answer
still yields bare numerals where the citations were.

**If this is revisited, superscript is the option not yet tried.** It is the conventional
answer to exactly this problem — a raised reference cannot be read as part of the sentence, and
it does not put punctuation inside a control. It was not attempted here because the pill's
minimum touch target is already near the 24 px WCAG 2.2 asks for, and shrinking it to sit
inline would need that measured rather than assumed.

**The underlying gap is untouched and stays in `docs/backlog.md`.** A marker that resolves
proves the passage was retrieved, not that it supports the sentence attached to it. This case
was a sharper edge of that — the marker was mistaken for the content rather than merely
trusted — and closing the general case needs an entailment check, not a presentation change.
