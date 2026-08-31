# 047 — Fewer passages for a smaller model

## Context

Both modes retrieved `RETRIEVAL_LIMIT = 8` passages per answer. That number was chosen
for Gemini and inherited by local mode when
[ADR 033](033-answering-locally.md) shipped in-browser generation, on the reasonable
assumption that more context cannot hurt.

It can. `Qwen2.5-0.5B-Instruct` loses answers that are sitting in front of it: the
harness in `eval/local-answers.md` retrieves the answering passage for **24 of 24**
questions and the model still grounds only 13 of them, against 17 when handed that
passage alone. The gap is distraction, and the passage count is the only lever on it
that costs nothing.

## Decision

**`LOCAL_RETRIEVAL_LIMIT = 3`, for local mode only.** Gemini keeps 8.

Measured over the 24-question set, with the distance floor applied first as
`lib/local/retrieve.ts` applies it:

| passages | actually given    | grounded  | answer retrieved |
| -------- | ----------------- | --------- | ---------------- |
| 3        | 2.8 avg           | **15/24** | **24/24**        |
| 8        | 5.5 avg           | 13/24     | 24/24            |
| oracle   | the answering one | 16/24     | by construction  |

Two rows better, and nothing lost: at three passages the answering chunk is still
retrieved every time, so the improvement is not bought by refusing more often. Three
also sits two rows below the ceiling of handing over the answering passage alone, which
is as close as retrieval can get without being an oracle.

## Why not change the shared constant

`lib/rag/retrieve.ts` and `lib/local/retrieve.ts` read the same 8, so one edit would
have changed cloud mode too. **Nothing here measures Gemini at three passages.** Cutting
a frontier model's context on evidence from a 0.5B model would be exactly the unfounded
swap the harness exists to prevent — the mistake [ADR 021](021-hybrid-retrieval-measured-and-not-shipped.md)
records in the other direction, where a measurement killed the obvious answer.

The two numbers are now separate because the two models are, and each is free to move
when someone measures it.

## Consequences

**The eval's default count follows the product.** `pnpm eval:local-answers` now scores
`LOCAL_RETRIEVAL_LIMIT` rather than `RETRIEVAL_LIMIT`; `--counts=3,8` still asks for
both. A default run measuring a configuration the product left behind is the same class
of defect as a mislabeled quantization.

**The pool the harness ranks stays at 8**, because `--counts=8` has to remain askable.
Only the slice handed to the model changed.

**Where the earlier figure came from.** An unfiltered sweep put three at 15/24 against
eight at 11/24 — a four-row gap. Re-measured with the floor applied first, the gap is
two rows: asking for eight yields 5.5 passages on average, so the floor was already
doing half the work the larger number claimed. The direction held; the size did not, and
the smaller figure is the honest one.

**What this does not fix.** Grounding at three is 15/24, so nine questions still fail
with the answer in front of the model, and citations remain at zero
([ADR 046](046-the-pin-survives-the-search.md)). This is the cheapest available
improvement, not a solution — the model is still the constraint.
