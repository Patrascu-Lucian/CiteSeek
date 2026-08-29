# 033 — Answering locally, and what a small model will not do

## Context

Local mode could store, index and retrieve. What remained was generation, and
[ADR 011](011-retrieval-and-citation-strategy.md)'s guarantee travelling with it:
sources are written **before** the model runs, so a marker resolves against a
payload that already exists. Reimplementing that ordering wrongly would make the
project's headline claim true in cloud mode only, which is worse than not
shipping local mode.

## Decision

**`onnx-community/Qwen2.5-0.5B-Instruct`, through transformers.js**, not WebLLM
as the milestone plan assumed.

The plan's choice would have added a second inference runtime, a second set of
CSP hosts and a multi-gigabyte download. transformers.js is already a dependency,
its ONNX runtime is already self-hosted ([ADR 032](032-the-only-remote-hosts-local-mode-needs.md)),
and `huggingface.co` is already the one allowed remote host. Nothing new is
trusted.

Measured, cached, on this machine:

|                         |                                                 |
| ----------------------- | ----------------------------------------------- |
| download                | **756 MB** (749.7 MB weights, 6.7 MB tokenizer) |
| load from cache         | ~3 s                                            |
| generate                | ~1.7 s                                          |
| first token, end to end | ~11 s                                           |

↳ **2026-08-12: every row below the download was measured on the CPU, and is superseded.**
This code passed no `device`, so transformers.js used its `wasm` default while the WebGPU gate
refused the feature to anyone without an adapter. [ADR 034](034-answering-on-the-gpu.md) sets
`device: "webgpu"`. Re-measured on the same machine and the same question, weights already
cached:

| first token | `device: "webgpu"`       | `device: "wasm"`       |
| ----------- | ------------------------ | ---------------------- |
|             | **2–3 s, ~5 s at worst** | no answer in over 60 s |

**The ~11 s above did not reproduce, and is withdrawn rather than quietly corrected.** The
same question on the CPU now runs past a minute, so that figure cannot have been this prompt
on this path. The likeliest explanation is that it was taken before retrieval was feeding real
passages into the system prompt — CPU prefill cost scales with prompt length, and the gap
between eleven seconds and sixty is about the size that would explain. That is a hypothesis,
not a measurement, which is exactly why the number is withdrawn instead of adjusted.

## What a 0.5B model would not do

**It ignored the citation rule entirely.** `buildSystemPrompt`'s rule 2 says to
cite every factual claim inline as `[1]`. With that prompt and nothing else,
neither the 0.5B nor the **1.5B** model emitted a single marker — the 1.5B
answered identically at three times the download and four seconds per answer, so
size was not the missing ingredient.

**One worked example fixed it.** A two-message exchange showing a cited answer,
appended after the system prompt, produced `[1]` immediately. At this size
instruction-following comes from demonstration rather than instruction.

↳ **Contradicted on CPU, 29 August 2026.** `pnpm eval:local-answers` gets **0 of 16**
cited — eight value questions and eight prose ones, none refused, several answering
in full sentences. That run is Node on `cpu`; this observation was a browser on
WebGPU. Same weights, different execution provider, so one of them is not measuring
what it thinks. Nothing here is withdrawn until it is re-measured in a browser
(`docs/backlog.md`), but it should not be quoted as current until then.

↳ **Re-measured in a browser, 29 August 2026, and withdrawn.** `pnpm eval:local-markers`
runs the 24-question set through `/local` on WebGPU — real page, real retrieval, one
browser per question. **Two answers of 24 carry a chip, and both are the defect rather
than the fix:** "The oil needs changing every 1 years" and "The torque takes 2 Nm",
where the document says 2,000 operating hours and 210 Nm. The marker is standing where
the number belongs, which is [ADR 038](038-a-citation-that-cannot-be-read-as-content.md)'s
failure and the same shape as the founding transcript, "Employees receive [1] days".
Both scored ungrounded. **Citations that cite something: 0 of 24, on the device this
paragraph was written on.**

So the worked example did not fix marker emission — it taught the model that a bracketed
number is a thing that appears in an answer. That reading fits the evidence better than
the original one and fits the CPU run too, which needs no device to explain it anymore.
What the example demonstrably changed was that markers appear at all; what it never
established is that they point at anything.

The device was the last cheap explanation for the citations, and it is gone: zero is zero on
both providers, at every passage count measured.

**Two full runs are byte identical** — 13/24 and 2/24, and all 32 answer lines the same, down
to the model's "regground". Greedy decoding reproduces on WebGPU as it does on the CPU, so a
single run here is evidence.

**Grounding is a different question and this run does not settle it.** 13/24 in the browser
against 11/24 in Node looks like agreement, and it is not comparable: local retrieval drops
anything past `maxDistanceFor("local")` before taking `RETRIEVAL_LIMIT`, while the Node
harness takes the top eight unfiltered. The browser therefore answered from fewer passages,
and the sweep in `docs/backlog.md` puts three passages at 15/24 and eight at 11/24 — which
brackets 13. Device and passage count are confounded here, so no claim is made about either
until the two harnesses retrieve alike.

Without that discovery local mode would have shipped answers with a source list
attached and nothing linking them — the acceptance criterion failing silently,
which is the exact shape of defect ADR 011 exists to prevent.

## Consequences

**The download is consented to before a byte is fetched**, stating both numbers:
756 MB, and answers taking seconds each. Declining leaves cloud mode working,
which is what makes the offer honest rather than a formality. `~11 s` to first
token is slow enough that cloud remains the recommendation for most readers, and
the gate says so.

**Two seams, one flag.** `__citeseekLocalEmbedder` swaps the embedder _and_ the
generator for deterministic stand-ins, because a test that fakes one and
downloads the other is neither fast nor honest. It is a runtime flag rather than
a build-time one so CI's E2E job runs the exact artifact the gate produced.

**`SourcePanel` takes a loader instead of a workspace id.** It resolved a
citation by fetching text from a route; local mode has no route, so the function
is injected — `workspaceDocumentText(workspaceId)` for the server, and one
reading IndexedDB for local. An E2E asserts a local citation opens with **zero**
`/api/w/` requests, which is what proves the two paths are the same component
rather than two implementations.

**The refusal stopped pointing at a workspace.** Its affordance rendered "the
upload area is at the top of _this workspace_" linking to `/w/${workspaceId}` —
in local mode, a link to nothing. It now takes `uploadHref`, where `null` means
the upload area is on this page. A bug found while wiring it: `uploadHref ?? …`
swallowed an explicit `null`, because `??` falls through on null as well as
undefined. The E2E caught it.

**Local mode downloads 884 MB in total**, across two models. The privacy page
now says so with both figures rather than "the model", which undercounted by an
embedding model nobody had consented to.

↳ **2026-08-13: greedy decoding loops, and the fix is ours rather than the model's.** Pushed on
a wrong answer — "you are wrong, document says 28 days" — the model repeated one paragraph seven
times until `max_new_tokens` cut it off. `do_sample: false` has no mechanism to leave a loop it
has entered.

**`repetition_penalty: 1.1` was tried first and did nothing — byte for byte the same output.**
Reading the implementation afterwards explains why, and it is not a matter of the value being
too low: the processor iterates `new Set(input_ids)` over the whole sequence, the prompt
included. It penalises a token for being _present_, not for being frequent, and every word of
that paragraph was already present in the retrieved passage. It was penalised identically before
the first repeat and after the seventh. The tool cannot see the difference this needed.

**`no_repeat_ngram_size` would work, and costs too much.** `getNgrams` also spans the prompt, so
banning a repeated n-gram forbids reproducing the passage's own wording — which rule 6 asks the
model to do when the phrasing matters. That trades a visible failure on an adversarial path for
a quiet one on the ordinary path.

**So the loop is detected here instead.** The stream is ours: `isLooping` checks whether the last
80 characters generated have already appeared earlier in the same answer, and interrupts through
the criteria the Stop button already uses. It reads only what the model wrote, never the prompt,
so quoting is untouched, and it catches the repeat on its second pass rather than its seventh.
Three unit tests pin it, including one asserting that long non-repeating prose runs to the end.

**It does not make the answers right.** The same session had the model answer "1" and then "two
days" about a document saying 28, and reach the correct figure only when the question contained
it. That is what a model small enough to fit in a browser does, and it is why `/local` ships
labelled experimental with the quality stated on the page before anything is downloaded.
