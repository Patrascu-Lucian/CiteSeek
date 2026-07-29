# 012 — Generation model

**Status**: accepted · **Date**: 2026-07-29 · **Milestone**: 2

## Context

The embedding model was settled in Milestone 1 (ADR 002). The generation model was
deliberately left open: the AI SDK abstracts providers, so the choice was cheap to defer and
got better with information. Milestone 2 is where it can no longer be deferred — the chat
route needs a model to call.

The backlog asked for this to be decided on evidence rather than reputation. That framing
needs one correction before it can be honored: there is no evidence yet. Answer quality can
only be compared once there is a working chat surface and real documents to ask about, and
building three provider integrations to pick one would invert the cost of the decision. What
can be decided now is which model to _start_ with, and how cheap it stays to change.

## Decision

**`gemini-3.5-flash-lite`, pinned to that exact identifier.**

### Why this model

- The Gemini API key already exists and is proven in production through the embedding path.
  A second provider would mean a second account, a second key in Vercel, and a second set of
  rate limits to reason about, in exchange for a quality difference nobody has measured.
- Free-tier limits comfortably exceed what a portfolio demo sees. The binding constraint on
  this project has consistently been requests per minute, not model capability.
- Flash-Lite is the right size for the task. The prompt does the hard work: passages are
  retrieved, numbered and delimited before the model sees them, and the model's job is to
  write prose over supplied text and mark where each claim came from. That is not a
  reasoning-heavy task, and a larger model would cost more per token for the same output.

### Why pinned, not `gemini-flash-lite-latest`

The alias is tempting — it tracks improvements for free. It also silently changes what the
model does, and generation behavior is exactly what must not change without a decision here:
the grounding and citation rules in `lib/ai/prompt.ts` are written against a specific model's
instruction-following, and the relevance floor in `lib/rag/retrieve.ts` will be tuned against
specific output. An alias that moves under a stable prompt turns a working system into a
subtly worse one with no commit to point at.

This is the same reasoning as ADR 003's rejection of `"node": ">=24.0.0"`. Floating version
pointers trade a known state for an unknown one, and the saving is a version bump nobody
minds making deliberately.

### The escape hatch stays one file

`lib/ai/provider.ts` remains the only module that names a provider or a model. Chat mirrors
embeddings exactly: a `CHAT_PROVIDER` knob (`google` | `fake`), unset meaning real, an unknown
value throwing rather than falling back. Switching provider is an edit to that file, not a
refactor.

Two knobs rather than one shared switch, because embedding and generation fail differently —
a rate-limited embedder stalls ingestion, a rate-limited generator breaks chat — and are
plausibly served by different vendors.

### A fake generation model, alongside the fake embedder

`CHAT_PROVIDER=fake` returns a deterministic model that streams a short answer citing `[1]`.
Without it, CI and the E2E suite could not exercise chat at all: there is no API key in CI,
and a live model is non-deterministic, rate-limited and occasionally down — three properties
that make a test suite flaky rather than thorough.

It is built on the SDK's own `MockLanguageModelV4` rather than a hand-rolled implementation.
The language-model interface belongs to the SDK and changes with it; a hand-rolled version
would drift silently on upgrade while still compiling.

## Consequences

- **This is a starting point, not a verdict.** The A/B the backlog asked for is now possible
  and should happen once there are real documents and a working UI. Candidates if quality
  disappoints: a larger Gemini model first, since it costs one identifier, then Groq or an
  OpenRouter free variant.
- **Commercial use needs a different tier regardless of model.** The free tier is for
  development and the seeded demo. Processing someone else's documents needs a paid tier or a
  DPA, which is a billing decision rather than a code change (ADR 007).
- **The prompt and the model are now coupled.** Changing model means re-checking that the
  citation rules still hold — a marker the model declines to write is a citation the user
  never sees.
- **The fake model asserts plumbing, not quality.** Every test that uses it proves markers
  become chips and the payload survives the round trip. None of them prove the real model
  cites correctly; that needs manual review against real documents, and it is the one part of
  this milestone no test can cover.
