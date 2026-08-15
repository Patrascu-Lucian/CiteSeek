# 032 — The only remote hosts local mode needs

## Context

[ADR 028](028-relaxing-the-policy-for-one-route.md) scoped the CSP relaxation to
`/local` and deliberately left `connect-src` at `'self'`, on the grounds that
allowlisting a CDN before observing a single request is guessing. It predicted
one specific trap: a weights URL redirects, and a redirect target is checked
against `connect-src` in its own right, so the host you type is not necessarily
the host the transfer touches.

This decision is what a real download actually did.

## Measured

Production build, a real embedding run, every request origin recorded:

| Host               | What it serves                       | Direction |
| ------------------ | ------------------------------------ | --------- |
| `huggingface.co`   | model config, tokenizer, weights URL | download  |
| `us.aws.cdn.hf.co` | the weights themselves, via redirect | download  |
| `cdn.jsdelivr.net` | the **ONNX Runtime WASM**            | download  |

The prediction held exactly. `huggingface.co` alone left the run blocked, with
the violation naming `us.aws.cdn.hf.co` — a host nothing in the source mentions,
reached only by following a redirect. The prefix is the **reader's** region, so
the allowlist uses a wildcard rather than pinning `us`.

The third host was not predicted at all, and it is the one that matters.

## Decision

**Two remote hosts, both serving data. The third is served from our own origin.**

```
connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co
```

**The ONNX runtime is copied into `public/onnx/` at build time** and
`env.backends.onnx.wasm.wasmPaths` points there. `pnpm onnx:copy` runs from
`prebuild` and `predev`, resolving the package through
`@huggingface/transformers` because pnpm keeps a transitive dependency out of the
root `node_modules`.

The distinction is the whole decision: **model weights are data, and the ONNX
runtime is code.** A CDN that serves the wrong weights produces bad answers; a
CDN that serves the wrong WASM executes whatever it likes in the reader's
browser, inside a page that has just been granted `'wasm-unsafe-eval'`. The
default also resolved to a `-dev` tagged build
(`onnxruntime-web@1.26.0-dev.20260416-…`), which is not a version anyone chose.

Rejected: allowing `cdn.jsdelivr.net` narrowed to that version's path. It works,
costs nothing to host, and it still means executable code arrives from a third
party — on a project whose CSP is one of the things it argues for.

## Consequences

**74 MB is copied into the deployment**, generated rather than committed and
gitignored. All four `ort-wasm-simd-threaded` variants, because which one the
runtime picks is not guessable from the outside and shipping one guesses on the
reader's behalf. Only one is ever fetched by a given reader.

↳ **2026-08-12: the guess in this paragraph was wrong.** It said `jsep` where
WebGPU is available and `asyncify` behind a proxy. Watched on a real run with
`device: "webgpu"` ([ADR 034](034-answering-on-the-gpu.md)), the browser fetches
**`asyncify`** — onnxruntime-web 1.22 replaced the JS-based WebGPU backend with a
native one requiring Asyncify or JSPI, and transformers.js defaults `wasmPaths`
to the asyncify pair for every non-Safari browser. Copying all four is what made
the wrong guess harmless, which is the argument for copying all four.

**The privacy page changed in this commit.** Local mode's claim is that nothing
leaves the machine, and the weights download does leave it: Hugging Face sees the
request the way any visited site does. The page now says so, says no document text
is sent, and says it is cached afterwards. A mode called Local that quietly
contacts a third party is the defect Milestone 6 closed on.

**The CSP test asserts the exact `connect-src` string**, not that it contains a
host. A relaxation that widened it further would otherwise pass, and this
directive is now the only one in the policy naming anything remote.

**This is measurement, not reasoning.** Two of the three hosts could not have been
derived from the source: one exists only as a redirect target, the other only as a
library's internal default. The instrument was a CSP violation log, which is worth
remembering the next time a remote dependency needs allowlisting.
