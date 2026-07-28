# 008 — Chunking strategy

**Status**: accepted · **Date**: 2026-07-28 · **Milestone**: 1

## Context

Retrieval operates on passages, not documents, so ingestion has to cut text somewhere. The
usual framing is "what size gives the best answers", but that question cannot be answered
yet: there is no chat, no queries, and therefore nothing to measure quality against. Picking
parameters now and calling them optimal would be a guess wearing a number.

There is a second constraint that _can_ be settled now, and it matters more. Milestone 2's
citations are literally `documents.contentText.slice(charStart, charEnd)`. If that slice
stops matching what was embedded, the product cites the wrong passage — confidently, with no
error anywhere in the system. Chunking is where that guarantee is either established or
quietly lost.

## Decision

**Structure-aware splitting with a size budget, and offsets as the primary invariant.**

### The invariant comes first

The chunker never rewrites text. It only chooses cut points, and every chunk's `content` is
a verbatim `slice` of its input. Even whitespace trimming is done by moving boundaries
rather than calling `.trim()`, because a trimmed string and its recorded offsets would
disagree.

`text.slice(charStart, charEnd) === chunk.content` is asserted in every structural test in
`chunking.test.ts`, not in one dedicated test — a regression that breaks it should fail
loudly and everywhere rather than in a single case someone might delete.

Offsets are UTF-16 code units, matching JavaScript string indexing and Postgres `text`.
A test with emoji guards against a byte-based implementation slicing a surrogate pair in half.

### Splitting: structure before size

Paragraphs are split **unconditionally**, not merely when a range is oversized. They are the
strongest semantic boundary extracted text has, and a chunk spanning one purely because the
combined length happened to fit is a worse passage for no benefit.

Only oversized pieces are reduced further, through progressively finer separators:

1. **Sentences** — `(?<=[.!?])[ \n]+`
2. **Any whitespace** — for text without sentence punctuation
3. **A hard cut** — minified files, base64 blobs, or languages written without spaces

Each fallback loses a little meaning, so each is reached only when the previous one could
not help. Naive fixed-size splitting was rejected because it routinely cuts mid-sentence,
which produces passages that read as broken when shown beside a citation.

### Sizes

| Parameter | Value       | Reasoning                                                                                                       |
| --------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| Target    | 1,200 chars | Roughly 250–300 tokens: large enough to carry an idea, small enough that a retrieved passage is mostly relevant |
| Maximum   | 1,500 chars | Headroom so a slightly-oversized paragraph is not split for the sake of 20 characters                           |
| Overlap   | 200 chars   | A sentence spanning a boundary stays retrievable from at least one side                                         |
| Ceiling   | 600 chunks  | ~500 pages; one pathological upload cannot consume a day of embedding quota                                     |

Overlap begins at a word boundary — a passage starting mid-word reads as corruption. It is
also **treated as context rather than an entitlement**: when carrying it forward would push
the next chunk past the maximum, it is dropped. That only happens with unbroken runs where
every piece is already maximum-sized, and where the overlapping text has no semantic value
to preserve anyway.

## Consequences

- These numbers are **defaults, not findings**. Milestone 2 is the first point at which
  retrieval quality can be measured, and this ADR should be revisited then with a
  before/after rather than an opinion.
- Overlap costs storage and embedding quota: roughly 15% more chunks than disjoint
  splitting. That is the price of not losing sentences at boundaries.
- The 600-chunk ceiling is a hard failure with an explanatory message, not a silent
  truncation. Silently indexing part of a document would make retrieval quietly incomplete —
  the worst failure mode for a product whose promise is grounded answers.
- Structure-aware splitting means chunk sizes vary. Anything downstream that assumes uniform
  chunks is wrong.
- Because page spans are recorded during extraction and never recomputed, a chunk knows
  which page it began on even though chunk boundaries and page boundaries are independent.
  Formats without pages report `null` rather than claiming page 1 — a citation asserting an
  unverifiable page number is worse than one admitting it has none.
