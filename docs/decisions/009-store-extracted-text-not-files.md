# 009 — Store extracted text, not the uploaded files

**Status**: accepted · **Date**: 2026-07-28 · **Milestone**: 1

## Context

Milestone 0's schema gave `chunks` a `charStart` and `charEnd` — offsets into a document's
text. Nothing stored that text. The offsets pointed into a string that existed only
transiently during ingestion, which meant the citation feature the whole product is built
around had nothing to slice.

Two ways to fix it: keep the uploaded file and render it, or keep the extracted text.

## Options considered

1. **Original files in object storage** (Vercel Blob or S3), rendered client-side —
   PDFs via pdf.js, docx via a converter.
2. **Extracted text in Postgres**, in a new `documents.contentText` column.
3. **Both** — files for fidelity, text for retrieval.

## Decision

Option 2. `documents.contentText` holds the canonical normalized text; the uploaded bytes
live only in the upload request's memory and are discarded once extraction finishes.
`documents.pageSpans` records where each page begins and ends within that text.

A citation therefore becomes `contentText.slice(charStart, charEnd)` — the same operation
for a PDF, a Word document and a Markdown file, with no per-format viewer.

Option 1 gives higher fidelity: the user sees their actual document, with layout and
images. It was rejected for Milestone 1 because it adds a second storage service, a second
data location to reason about under GDPR, and a different rendering path per file type —
substantial work in service of fidelity that the citation feature does not require. It
remains on the backlog as an upgrade if the text view proves insufficient in real use.

## Consequences

- **Erasure is one SQL statement.** Deleting a user cascades to workspaces, documents and
  chunks; because there are no files anywhere, nothing is orphaned. The roadmap's "deleting
  a document removes file, chunks, AND embeddings" is satisfied structurally — embeddings
  live in `chunks.embedding`, so they go with the row. "Removes file" maps to `contentText`,
  since no original bytes are kept. See `lib/users/deletion.ts`.
- **Page spans had to be stored, not computed.** They are derived during extraction from
  `unpdf`'s per-page output. Since the original file is discarded, they can never be
  recomputed — adding the column later would require re-uploading every document. That
  makes it effectively a one-way door, and one jsonb column now is cheaper than a migration
  nobody can backfill.
- **No original formatting, images or layout.** A citation shows text, not a page. For a
  product whose claim is "this passage says X", text is the claim being made.
- **Re-chunking requires no re-upload** — the canonical text is still there — but changing
  the _extraction_ (a better PDF parser, OCR) does.
- **Parsing safety.** `unpdf` and `mammoth` are pure JavaScript: no shell-outs, no native
  binaries, and uploaded bytes are never written to disk or executed. Combined with a size
  cap and magic-byte checks, this keeps the "malware-safe parsing" bar (quality bar #5)
  a property of the design rather than of a scanner.
- **Errors must never contain document text.** `documents.error` stores a sanitized
  exception message only. Quality bar #8 forbids logging document contents, and an error
  column is a log by another name.
