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

## What a 0.5B model would not do

**It ignored the citation rule entirely.** `buildSystemPrompt`'s rule 2 says to
cite every factual claim inline as `[1]`. With that prompt and nothing else,
neither the 0.5B nor the **1.5B** model emitted a single marker — the 1.5B
answered identically at three times the download and four seconds per answer, so
size was not the missing ingredient.

**One worked example fixed it.** A two-message exchange showing a cited answer,
appended after the system prompt, produced `[1]` immediately. At this size
instruction-following comes from demonstration rather than instruction.

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
