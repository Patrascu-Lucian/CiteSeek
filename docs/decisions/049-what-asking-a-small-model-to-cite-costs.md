# 049 — What asking a small model to cite costs, measured

## Context

Local mode is told to cite and does not: **0 of 24** answers carry a marker that
resolves ([ADR 046](046-the-pin-survives-the-search.md)). `buildSystemPrompt`
spends three of its seven rules on citation, and `generateLocally` appends a
worked example on top — instructions for a capability the model has repeatedly
failed to demonstrate.

Two observations suggested the instruction might be actively costing answers:

- At eight passages the model cited twice and grounded 13/24; at three it cited
  nothing and grounded 15/24 ([ADR 047](047-fewer-passages-for-a-smaller-model.md)).
- `gemma-3-270m` cites 14 of 24 while grounding **zero** — marker emission and
  grounding are independent, so they might compete.

If they do compete, the citation rules are buying nothing and charging for it.

## Decision

**Keep the prompt as it is.** The instruction is not costing answers.

Measured with `pnpm eval:local-answers --no-citations --no-example`, which drops
the three citation rules and the worked example, at the shipping passage count:

| prompt                 | grounded  | cited |
| ---------------------- | --------- | ----- |
| shipped                | 15/24     | 0/24  |
| citation parts removed | **16/24** | 0/24  |

One row, on a model whose runs are byte-identical — so it is a real difference
rather than sampling noise, and far too small to justify what taking it costs.

**The row-level result is the finding, not the total.** Five questions changed
answer, not one: three gained, two lost. Removing the instruction rearranges
which questions the model happens to get right rather than improving it, and a
net of +1 is what that churn adds up to. A prompt change that moves five rows in
both directions is not an improvement with a small effect size; it is a
different roll of the same dice.

## Consequences

**`buildSystemPrompt` stays shared between both modes.** [ADR 033](033-answering-locally.md)
made it shared so the citation rules, the injection defense and the refusal
wording could not drift apart, and a one-row gain is not worth two prompts to
keep in step.

**The rules are data now, not a blob.** They were one string with hand-written
numbers, so dropping rules 2–4 would have left a prompt counting 1, 5, 6, 7.
They are three arrays numbered at build time, which is what made the experiment
possible; the 17 existing prompt tests pass unchanged, so the shipped text is
byte-for-byte what it was.

**The flags stay.** `--no-citations` and `--no-example` cost nothing to keep and
are the way to re-ask this of a different model. Whoever swaps the pin should
re-run them rather than assume this transfers: the answer is about a 0.5B, not
about small models.

**What this does not settle.** Whether a _different_ citation instruction would
work — a numeric exemplar rather than a sentence, which `docs/backlog.md` has
carried since ADR 033. This measured removing the instruction, not replacing it,
and those are different questions.
