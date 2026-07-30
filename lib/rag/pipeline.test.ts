import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { chunkText } from "./chunking";
import { embedPassages } from "./embeddings";
import { extractText } from "./extract";
import { EMBEDDING_DIMENSIONS, isUnitVector } from "./vector";

/**
 * Extraction → chunking → embedding, run over real files.
 *
 * The unit suites cover each stage against synthetic input. This one exists
 * because the offset invariant can hold at every stage in isolation and still
 * break at a seam — normalization applied twice, or page spans computed against
 * a different string than the one stored. Those failures are invisible until a
 * citation shows the wrong text, so they are worth catching against actual
 * documents.
 */

const FIXTURES = join(import.meta.dirname, "__fixtures__");

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

const CASES = [
  { file: "sample.pdf", mime: "application/pdf", hasPages: true },
  {
    file: "sample.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    hasPages: false,
  },
  { file: "sample.md", mime: "text/markdown", hasPages: false },
] as const;

describe.each(CASES)("$file", ({ file, mime, hasPages }) => {
  it("produces chunks whose offsets index into the stored text", async () => {
    // The single most important assertion in the project: this is exactly what
    // Milestone 2 will slice to render a citation.
    const { text, pageSpans } = await extractText(fixture(file), mime);
    const chunks = chunkText(text, pageSpans);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(text.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.content);
    }
  });

  it("reports page numbers only when the format has pages", async () => {
    const { text, pageSpans } = await extractText(fixture(file), mime);
    const chunks = chunkText(text, pageSpans);

    for (const chunk of chunks) {
      if (hasPages) {
        expect(chunk.pageNumber).toBeGreaterThanOrEqual(1);
      } else {
        expect(chunk.pageNumber).toBeNull();
      }
    }
  });

  it("embeds every chunk to a storable vector", async () => {
    const { text, pageSpans } = await extractText(fixture(file), mime);
    const chunks = chunkText(text, pageSpans);

    // The fake embedder keeps this keyless and deterministic; it proves shape
    // and plumbing, not retrieval quality.
    const { vectors: embeddings } = await embedPassages(
      chunks.map((c) => c.content),
    );

    expect(embeddings).toHaveLength(chunks.length);
    for (const embedding of embeddings) {
      expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(isUnitVector(embedding)).toBe(true);
    }
  });
});

describe("page attribution across a real multi-page PDF", () => {
  it("assigns each chunk to the page its text came from", async () => {
    const { text, pageSpans } = await extractText(
      fixture("sample.pdf"),
      "application/pdf",
    );
    const chunks = chunkText(text, pageSpans);

    for (const chunk of chunks) {
      const span = pageSpans!.find((s) => s.pageNumber === chunk.pageNumber)!;
      // The chunk must start within the page it claims.
      expect(chunk.charStart).toBeGreaterThanOrEqual(span.charStart);
    }
  });

  it("keeps page-one and page-two content distinguishable", async () => {
    const { text, pageSpans } = await extractText(
      fixture("sample.pdf"),
      "application/pdf",
    );

    expect(
      text.slice(pageSpans![0]!.charStart, pageSpans![0]!.charEnd),
    ).toContain("Retrieval augmented generation");
    expect(
      text.slice(pageSpans![1]!.charStart, pageSpans![1]!.charEnd),
    ).toContain("Citations must point");
  });
});
