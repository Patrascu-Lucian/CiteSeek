# 046 — The pin survives the search for a better small model

## Context

[ADR 033](033-answering-locally.md) pinned `Qwen2.5-0.5B-Instruct` in August 2026 and
recorded what it will not do. The pin is 2024-vintage, and `docs/backlog.md` has carried
"try a newer small model" ever since — reasonably, since a 2026 1B-class instruct model
plausibly beats a 2024 0.5B at a similar download.

That entry also ordered its own work: **score before swapping**, because every judgement
about local answer quality until then was a transcript and an impression. Scoring now
exists ([ADR 033](033-answering-locally.md), and `eval/local-answers.md`), and the pinned
model's numbers are **13/24 grounded, 2/24 cited** at the shipping passage count.

## Decision

**Keep `Qwen2.5-0.5B-Instruct`.** Nothing displaced it, and the search stops here.

| model                         | download | grounded  | cited | outcome                   |
| ----------------------------- | -------- | --------- | ----- | ------------------------- |
| `Qwen2.5-0.5B-Instruct` (pin) | 756 MB   | **13/24** | 2/24  | stands                    |
| `gemma-3-270m-it`             | 308 MB   | **0/24**  | 0/24  | measured, unusable        |
| `Qwen3-0.6B`                  | 877 MB   | —         | —     | exceeds the measuring rig |
| `Llama-3.2-1B-Instruct`       | 1614 MB  | —         | —     | not attempted, see below  |

## gemma-3-270m answers the prompt instead of the question

Zero grounded, including **zero on the oracle** — handed the answering passage, it still
never produced the value. The transcripts say why: it replies to the system prompt.

> Okay, I'm ready to answer your questions. I've reviewed the provided passages and their
> corresponding rules. I'm ready to answer your questions as instructed.

**Checked before believing it.** gemma has no `system` role, so a zero here could easily
have been our two-message shape mis-delivering the prompt — measuring our plumbing and
calling it the model. Its chat template turns out to handle a system message by prepending
it to the first user turn, so the prompt arrives intact. The zero is the model: 270M
parameters is below the floor for a prompt carrying rules, passages and a worked example.

One detail worth keeping, because it supports [ADR 033](033-answering-locally.md)'s revised
reading of the worked example: gemma **cited on 3 of 8** prose questions where the pin cites
0 of 8. It emits markers more readily and answers less. Marker emission and grounding are
independent capabilities, and buying the first buys nothing of the second.

## Qwen3-0.6B could not be measured here, which is not the same as losing

Three runs died at ~4.3 GB. The cause is not the download size:

- **The CPU execution provider dequantizes q4 weights to fp32 at load.** 0.6B parameters
  is ~2.4 GB before activations or KV cache, on a 16 GB machine with roughly 6 GB spare.
- Node's default heap ceiling is **4288 MB**, which is why every death landed on the same
  number. Raising it to 8 GB did not help, because the machine did not have 8 GB to give.
- `int8` (589 MB) was tried as a screening pass and died at 3951 MB.

**This is a fact about the rig, not the model.** In the product the model runs on WebGPU,
where q4 stays quantized and 877 MB is a download rather than an expansion. Qwen3-0.6B may
well be better than the pin; this hardware cannot say. Recorded as unmeasured rather than
scored, because a number produced by a different quantization on a starved machine would be
worse than no number.

**`Llama-3.2-1B` was not attempted.** It is twice Qwen3's size on the same arithmetic that
already fails, and attempting it would spend an hour to reproduce a known ceiling.

## Consequences

**The measuring rig has a ceiling of about 0.5B at q4**, which bounds what this harness can
compare. Testing anything larger needs the browser harness (`pnpm eval:local-markers`)
taught to take a model — real work, and the reason the search stops rather than continues.

**`loadChatModel` takes a `dtype`**, defaulting to the shipped `q4`. The report prints the
quantization in its header and says outright that a non-`q4` run is not comparable, because
this is exactly the shape of number that gets quoted a year later without its caveat.

**`generateLocally` asks the chat template not to think.** Qwen3 is a reasoning model: its
template emits a `<think>` block that would spend the whole token budget before answering,
and a reader would watch it stream. `tokenizer_kwargs: { enable_thinking: false }` reaches
the template through the pipeline; templates without the variable ignore it, so the pin is
unaffected. Found while measuring, kept because it is a product defect either way.

**The tokenizer is cached beside the weights.** `AutoTokenizer.from_pretrained` ran on every
question — a 6.7 MB vocabulary re-parsed per answer, in the product path. Also found while
measuring; also kept on its own merits.

**What would reopen this**: a candidate that runs on the browser harness, or a rig that can
hold a 1B model at q4. The question is not settled, only stopped — and it is stopped with
the pinned model's numbers on the record rather than an impression.
