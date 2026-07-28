# 011 — Retrieval and citation strategy

**Status**: accepted · **Date**: 2026-07-28 · **Milestone**: 2

## Context

Milestone 1 established that a stored chunk's text is exactly
`documents.contentText.slice(charStart, charEnd)` (ADR 008). That invariant exists for one
reason: so a citation can open the source document at the passage an answer actually came
from. Milestone 2 is where it gets used, and where the product's central claim — _every
answer cites real passages, and says so when it cannot_ — is either built into the
architecture or left as a hope about model behavior.

Two questions have to be answered together, because the answer to one constrains the other:
how does the model tell us which passage it used, and what happens when no passage is
relevant?

## Decision

### Citations are numbered markers, resolved server-side

Retrieved passages are numbered `[1]…[k]` and rendered into the prompt inside delimited
blocks. The model writes markers inline in its prose. The client resolves each marker
against a source list the server sent, and renders it as a chip.

**The model chooses which marker to write. It never supplies what a marker points at.** The
mapping from `2` to a chunk id, document id, page and character span is built from the
retrieval result and never shown to the model, so there is nothing for it to fabricate. A
marker outside the range simply has no matching source, and renders as plain text rather
than a dead chip pointing nowhere.

This is what makes "no hallucinated citations" a structural property. The alternative —
asking the model to emit chunk ids and trusting them — makes citation accuracy a function of
the model's ability to copy a UUID, which is exactly the kind of thing small models get
subtly wrong.

Two alternatives were considered and rejected:

- **A tool call per citation.** Correct in principle, and it would let the model fetch
  passages on demand. But tool results interleave awkwardly with a token stream, and each
  round trip delays first token — the metric this milestone has to report.
- **Structured output** (a JSON object with `answer` and `citations`). Cleanest data shape,
  and it forfeits streaming entirely: the user watches a spinner until the object is
  complete. For a product whose demo _is_ watching an answer appear, that is the wrong
  trade.

Markers cost one parsing step on the client and keep both streaming and grounding.

### Sources are streamed before the text

The route writes a `data-sources` part into the UI message stream _before_ merging the
model's token stream. Chips can therefore resolve the instant a marker arrives, rather than
after the message completes. It also means the citation payload is committed before the
model has written a word — the sources are a fact about retrieval, not a summary of what the
model claimed.

### A relevance floor, enforced before the model is called

Retrieval applies a maximum cosine distance. When nothing clears it, **the model is not
called at all** — a fixed reply says nothing relevant was found.

Instructing a model to refuse when context is weak works most of the time. Not calling it
works every time, costs nothing, and returns faster. It also removes the failure mode that
would be most damaging here: a fluent, confident answer assembled from training data and
presented inside a product whose entire promise is that answers come from your documents.

The threshold is provisional and documented as such in `lib/rag/retrieve.ts`. It cannot be
tuned against the fake embedder — those vectors are deterministic hashes with no semantic
geometry, so distances between them carry no information about relevance. Tuning happens
against the real embedding model on real documents.

### Retrieved content is data, never instructions

Passages are wrapped in delimited blocks, and the system prompt states before any document
text appears that their contents are untrusted quoted material. Delimiter syntax occurring
inside retrieved text is neutralized, so a document cannot close its own block and have the
text after it read as though it came from outside.

The rules are stated _before_ the passages, so an instruction smuggled into a document
arrives after the model has been told how to treat it. Reporting that a document contains
such text remains a legitimate answer about the document — the defense is against acting on
it, not against discussing it.

## Consequences

- Citation accuracy degrades gracefully. A model that cites the wrong passage is wrong in a
  way the user can see and check, because the chip opens the source. A model that cites a
  passage that does not exist produces no chip at all.
- The marker → source mapping must survive persistence. Stored citations are written in
  marker order, so `[n]` resolves to `citations[n - 1]` identically during streaming and
  after a reload.
- Ordering becomes load-bearing. Because markers are positional, retrieval must return
  passages closest-first deterministically; the query restates its ordering in the outer
  select rather than relying on a subquery's order surviving.
- The relevance floor is a product-visible knob. Set too high it refuses answerable
  questions; too low it lets weak passages through. It needs measurement against real
  documents before the numbers in the README mean anything.
- Filtering by distance cannot use the HNSW index — an approximate index answers
  "nearest k", not "everything within x". The floor is therefore applied outside the
  index-accelerated query, over the k rows it returns.
