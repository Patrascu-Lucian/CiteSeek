# 061 — A decline about an earlier question

**Status**: proposed, 22 October 2026. The method and the rule below are committed before the run
they judge; the result is added after it.

## Context

The 1.11.0 exit check asked three questions in one conversation, in a workspace holding the eval
fixtures. The second, "What is the cap on credits in a month?", came back as:

> "The documents do not cover the press, but they cover support plans, credits, escalation, data
> handling, and ending a support plan. The cap on credits in any calendar month is 25% of the
> monthly fee [1]."

The value and the citation are right. The opening declines the _previous_ question, about the
press. It is the declining form, so the page links none of the reply's markers and says the reply
declines the question ([ADR 058](058-a-reply-that-declines-links-nothing.md)). ADR 058 priced a
partial answer losing its link; this is a complete answer losing it because of an earlier turn.

The mechanism is in the chat route. It sends the whole transcript, through
`convertToModelMessages`, which keeps each earlier question and answer as text and drops the
sources attached to them. The system prompt carries only the passages retrieved for the latest
question. So the model reads the earlier answer, "The press develops 90 kilonewtons [1]", beside
passages about credits, and two readings fit what it then writes: it checks the earlier topic
against passages that do not cover it, or the earlier answer's `[1]`, which now names a credits
passage, makes that answer look unsupported.

The shape is not new. [ADR 059](059-passages-per-answer-for-gemini.md) measured the same hedge on
single questions whenever the model sees less of what it is asked about: 2 of 24 at three passages,
3 of 24 on the answering passage alone, none at eight. A conversation is another way of seeing less.

No committed report can show this. Every eval asked each question in a fresh conversation, and
local mode sends one user message, so it cannot fail this way at all.

## Options

- **Append one sentence to rule 7, about earlier turns.** A prompt change, so it is measured before
  it ships, under the rule below. Appended rather than woven in, so the opener rule 7 asks for, which
  is the phrase the page's detector reads, stays word for word.
- **Have the detector read past the opener.** Rejected for ADR 058's own reason: telling a decline
  about an earlier question from a decline about this one needs a reading of what follows, which is
  a heuristic guarding a guarantee.
- **Drop the history.** Rejected: follow-ups such as "why?" need it, and the rewrite that recovers a
  follow-up's subject reads it ([ADR 044](044-rewriting-a-follow-up-only-after-it-fails.md)).
- **Send the earlier turns' passages again.** Rejected: it multiplies the context per turn, and
  their markers would collide with this turn's numbering.
- **Strip markers from the history.** Not measured here, so this ADR cannot say whether stale markers
  are the cause. A structural remedy would need its own record.

## The candidate

Rule 7 as shipped, followed by:

> Decline only the latest question. The passages below were retrieved for it alone: earlier turns
> were answered from passages no longer shown, and their markers do not refer to these. Use earlier
> turns only to understand what the latest question refers to, and never open by declining
> something asked earlier.

It states the cause rather than only forbidding the symptom, it covers both readings above, and it
tells the model what earlier turns are still for. It does not quote the declining opener, so a model
that copies wording has nothing to copy it from.

## The method

`pnpm eval:answers --conversation --rule7=candidate` asks each of the 24 questions in `ANSWER_SET`
three ways in one session: alone, after a question about another document (topic change), and after
one about the same document (same topic). The pairs are fixed in `CONVERSATION_SET`, committed
before any model saw them, and the credit cap follows the press. The ten follow-ups in
`FOLLOW_UP_SET` are asked after their context turn, and two sequences are asked in order: the exit
check's three questions on the fixtures, and the demo's three starter questions on the handbook.

The earlier turn is answered once, with the shipped wording, and both wordings answer the next turn
on that same history, so they differ in one thing: the system prompt at that turn. History goes
through the route's `convertToModelMessages`, and retrieval follows the route's order, the rewrite
included. Three runs; a question's result is the majority of them.

Each reply is scored on what it can be checked against:

- **`ANSWER_SET` replies:** grounded (it states the expected value), cites (a marker the page links
  points at the passage holding it), and **read as a refusal**: grounded, and opening in a declining
  form with markers, so the page unlinks a right answer.
- **Follow-ups:** cites and declined, since they name no value to ground against.
- **The handbook's starters:** whether the page unlinked the reply, since nothing says what their
  right answer is.

## The rule, fixed before the run

1. **The gate.** It reads the shipped wording's replies that can be read as a refusal at all: the
   second turn after a topic change and after a same-topic turn, and turns two and three of the exit
   check's sequence, 50 replies a run and 150 in all. If none is read as a refusal, the result is
   "measured, not reproduced": rule 7 does not change, the rate (0 of 150) is recorded here, and the
   public copy says the case was seen on the live site. A follow-up or a starter that declines is
   quoted in the result but cannot open the gate, because nothing tells a right answer that opens by
   declining from a plain false refusal there.
2. **Adoption.** Otherwise the candidate replaces rule 7 only if all three hold, each measured in the
   same session as its baseline:
   - **(a)** The run's verdict is `change`, by `decideDefault` with at least one question gained.
     Compared question by question, no question gets worse on any outcome in any condition: grounded,
     cites and not read as a refusal, alone, after a topic change and after a same-topic turn; cites
     and not declined, for follow-ups.
   - **(b)** `pnpm eval:refusals --rule7=candidate` renders no marker as a link and counts no
     out-of-range marker, in every run of every set. Every reply outside the column of replies that
     open in a declining form the page recognizes is quoted in the result and read as a decline or
     not.
   - **(c)** Local mode answers no worse. `pnpm eval:local-answers --counts=3,8` with and without
     the candidate, back to back on one lockfile, grounds at least as many questions in total at
     three passages, and every question that changes is listed. The bar is the total rather than each
     question, because this model rearranges which questions it gets right on any prompt change
     ([ADR 049](049-what-asking-a-small-model-to-cite-costs.md)).
3. **A second session.** If the verdict would flip on one or two questions gained or lost, the whole
   session runs again before it is read. The verdict stands only if both sessions return it;
   otherwise rule 7 stays as shipped.

## Known properties

- **Stale markers.** Earlier answers keep markers that pointed at their own turn's passages, while
  the system prompt numbers this turn's from 1. Not measured on their own, as above.
- **Two questions share one answer.** "How much notice do I give to move out?" and "How much notice
  do I give if I am leaving?" both expect the tenant's month, so the pairs never put them together:
  one would carry the other's answer in its history.
- **A new topic is always a new document.** The fixtures are three short documents with one subject
  each, so these runs cannot tell the two apart. The same-topic condition stays inside one document,
  and it is the control for both.

## Result

Added after the run.
