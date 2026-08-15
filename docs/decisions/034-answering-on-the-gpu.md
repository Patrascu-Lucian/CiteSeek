# 034 — Answering on the GPU, and four things review found after the fact

## Context

[ADR 033](033-answering-locally.md) shipped local generation. A review of the merged branch
found that the feature was not doing what the two ADRs around it said it was doing, and that
the shipped store had made an existing browser's documents un-citable.

None of it was caught by the gate. Everything was green.

## The gate was checking for something the code never asked for

`loadChatModel` called `pipeline("text-generation", …, { dtype: "q4" })` with **no `device`**.
transformers.js then falls back to `DEFAULT_DEVICE`, which is `wasm` in a browser
(`transformers.js:13557`). So generation ran on the CPU while `WebGpuGate` —
[ADR 027](027-detecting-webgpu-before-offering-local-mode.md)'s whole slice — refused the
feature to anyone without an adapter.

The proof was already in the repo: the embedder has the same shape, sits **outside** the gate,
and indexes documents on machines with no GPU at all.

Two readings, and they are not equally good. Dropping the gate would have been honest and
small, and would have left every answer on the CPU forever. **Naming the device is what the
surrounding documents already claimed**, so `device: "webgpu"` is set and the gate becomes
true rather than decorative.

Measured after the change, same machine, same question, weights cached:

| first token | `device: "webgpu"`       | `device: "wasm"`       |
| ----------- | ------------------------ | ---------------------- |
|             | **2–3 s, ~5 s at worst** | no answer in over 60 s |

That gap is the justification. It also settles what the gate is: not a performance heuristic
but a requirement, because the CPU path does not produce an answer a reader would wait for.
Firefox is excluded from local mode until it ships WebGPU, and the unavailable screen naming
cloud mode is the whole of what we can offer there.

The consequence to be explicit about: **ADR 033's timings were measured on wasm**, and the
~11 s first token in them does not reproduce — see the correction there. It is withdrawn
rather than adjusted.

## What else the review found

**The download percentage was per file.** transformers.js wraps `progress_callback` and emits
an aggregate `progress_total` immediately followed by the per-file `progress` for the same
bytes (`transformers.js:190`). The filter kept the per-file event, so the readout reached
100% on a 4 KB config, dropped to zero, reached it again on the tokenizer, and only then
began the weights. The test passed because it mocked the pipeline and emitted a raw
`progress` — a stand-in that was more convenient than the thing it stood in for.

The aggregate is better, not perfect: its total sums only the files that have reported so
far, so the percentage still falls when a large file registers late. It never claims to be
finished when it is not, which is the property that mattered.

**Stop did not stop.** `useChat`'s stop cancels the stream and re-enables the composer;
nothing reached the model, which ran on to `max_new_tokens`. The part that makes this more
than cosmetic: the reader can then ask again, and a second generation starts on the same
pipeline while the first is still running. The signal now drives an
`InterruptableStoppingCriteria`.

**Documents from the previous version stopped being citable.** `text` became required on
`LocalDocument` while `DATABASE_VERSION` stayed at 1, and `onupgradeneeded` does not fire for
a database that already exists. Those records keep `status: "ready"`, so they retrieve, they
get cited, and only then does the panel report the passage missing — the guarantee failing
_after_ the claim, which is the exact shape [ADR 011](011-retrieval-and-citation-strategy.md)
exists to prevent. Version 2 marks them failed with a message saying to add them again.

## Consequences

**A stand-in that is easier than the real thing tests the stand-in.** The progress mock and
the `generateLocally` mock both passed while the real call did something else. Where a wrapper
sits between our code and the library — and here one did, undocumented in our types — a unit
test cannot see it. Both are now pinned by asserting the arguments actually handed to
`pipeline`.

**A required field is a migration, whatever the store's shape.** IndexedDB has no schema to
fail against, so adding `text` looked free and was not. The rule going in with it: a new
required field on a persisted type changes `DATABASE_VERSION` in the same commit.

**The consent gate states two or three seconds, not "a few".** It said "a few seconds" while
the measurement behind it was eleven, and a gate whose purpose is informed consent cannot
round in its own favor — in either direction, which is why this says the typical figure rather
than the worst one.

**The gate's copy no longer announces every percent.** `role="status"` on a string containing
the percentage queues about a hundred announcements into a screen reader during one download.
The live region now carries the coarse message and a `<progress>` element carries the number.

**The refusal stopped naming a workspace.** "Answers here come only from documents in this
workspace" is the first sentence a reader on `/local` sees before anything is indexed, and
there is no workspace. It reads "the documents available here", which is true in both modes.
