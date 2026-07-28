import { describe, expect, it } from "vitest";

import {
  CHUNK_MAX_CHARS,
  CHUNK_TARGET_CHARS,
  DocumentTooLargeError,
  MAX_CHUNKS_PER_DOCUMENT,
  chunkText,
} from "./chunking";
import { joinPages } from "./normalize";

/** Prose that splits on paragraph boundaries, sized to force multiple chunks. */
function paragraphs(count: number, sentencesEach = 6): string {
  return Array.from({ length: count }, (_, p) =>
    Array.from(
      { length: sentencesEach },
      (_, s) =>
        `Paragraph ${p} sentence ${s} carries enough words to occupy a measurable amount of the chunk budget.`,
    ).join(" "),
  ).join("\n\n");
}

/**
 * The invariant everything downstream depends on. Asserted in every structural
 * test rather than once, because a chunker that returns sensible passages with
 * drifting offsets produces citations that are confidently wrong and silent.
 */
function expectSliceInvariant(
  text: string,
  chunks: ReturnType<typeof chunkText>,
) {
  for (const chunk of chunks) {
    expect(text.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.content);
  }
}

describe("chunkText — the slice invariant", () => {
  it("holds for prose", () => {
    const text = paragraphs(12);
    expectSliceInvariant(text, chunkText(text));
  });

  it("holds for a single short document", () => {
    const text = "One short sentence.";
    expectSliceInvariant(text, chunkText(text));
  });

  it("holds for text with no whitespace at all", () => {
    const text = "x".repeat(CHUNK_MAX_CHARS * 3);
    expectSliceInvariant(text, chunkText(text));
  });

  it("holds for text full of irregular whitespace", () => {
    const text = paragraphs(6).replace(/ /g, "   ");
    expectSliceInvariant(text, chunkText(text));
  });

  it("holds for non-ASCII text", () => {
    // Offsets are UTF-16 code units; emoji are surrogate pairs, so a naive
    // byte-based implementation would slice one in half here.
    const text = Array.from(
      { length: 40 },
      (_, i) =>
        `Ceci est le paragraphe ${i} avec des accents éàü and an emoji 🎯.`,
    ).join("\n\n");

    expectSliceInvariant(text, chunkText(text));
  });
});

describe("chunkText — structure", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns one chunk when the text fits", () => {
    const chunks = chunkText("Short enough to stay whole.");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe("Short enough to stay whole.");
    expect(chunks[0]!.charStart).toBe(0);
  });

  it("numbers chunks consecutively from zero", () => {
    const chunks = chunkText(paragraphs(15));
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it("keeps every chunk within the maximum size", () => {
    for (const chunk of chunkText(paragraphs(20))) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    }
  });

  it("produces chunks in ascending, non-decreasing order", () => {
    const chunks = chunkText(paragraphs(15));

    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]!.charStart).toBeGreaterThan(chunks[i - 1]!.charStart);
    }
  });

  it("covers the document — no text between chunks is lost", () => {
    // Overlap means chunks are not disjoint, but their union must still span
    // everything except whitespace trimmed at the seams.
    const text = paragraphs(10);
    const chunks = chunkText(text);

    let covered = 0;
    for (const chunk of chunks) {
      expect(chunk.charStart).toBeLessThanOrEqual(covered + 1);
      covered = Math.max(covered, chunk.charEnd);
    }
    expect(covered).toBe(text.length);
  });

  it("never emits a chunk that is only whitespace", () => {
    const text = `${paragraphs(3)}\n\n\n\n${paragraphs(3)}`;

    for (const chunk of chunkText(text)) {
      expect(chunk.content.trim()).not.toBe("");
    }
  });

  it("does not start or end a chunk on whitespace", () => {
    for (const chunk of chunkText(paragraphs(10))) {
      expect(chunk.content).toBe(chunk.content.trim());
    }
  });
});

describe("chunkText — overlap", () => {
  it("overlaps consecutive chunks so context spans the seam", () => {
    // Without overlap, a sentence split across a boundary is retrievable from
    // neither chunk.
    const text = paragraphs(12);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i += 1) {
      expect(chunks[i]!.charStart).toBeLessThan(chunks[i - 1]!.charEnd);
    }
  });

  it("begins the overlap at a word boundary", () => {
    // A chunk starting mid-word reads as corruption when shown beside a citation.
    const text = paragraphs(12);
    const chunks = chunkText(text);

    for (let i = 1; i < chunks.length; i += 1) {
      const precedingChar = text[chunks[i]!.charStart - 1];
      expect(precedingChar === undefined || /\s/.test(precedingChar)).toBe(
        true,
      );
    }
  });
});

describe("chunkText — splitting strategy", () => {
  it("prefers paragraph boundaries", () => {
    const first = "A".repeat(CHUNK_TARGET_CHARS - 100);
    const second = "B".repeat(300);
    const chunks = chunkText(`${first}\n\n${second}`);

    // The B paragraph should not be merged into the A chunk.
    expect(chunks[0]!.content).not.toContain("B");
  });

  it("falls back to sentences inside an oversized paragraph", () => {
    const sentence = "This sentence is a unit that should survive intact. ";
    const oversized = sentence.repeat(
      Math.ceil(CHUNK_MAX_CHARS / sentence.length) + 5,
    );
    const chunks = chunkText(oversized);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    }
  });

  it("hard-splits an unbroken run rather than emitting an oversized chunk", () => {
    // Minified files and base64 blobs have no separators anywhere.
    const chunks = chunkText("z".repeat(CHUNK_MAX_CHARS * 2 + 50));

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    }
  });
});

describe("chunkText — page numbers", () => {
  it("assigns the page a chunk starts on", () => {
    const { text, pageSpans } = joinPages([
      "Alpha content on the first page.",
      "Bravo content on the second page.",
    ]);
    const chunks = chunkText(text, pageSpans);

    expect(chunks[0]!.pageNumber).toBe(1);
    expectSliceInvariant(text, chunks);
  });

  it("assigns later pages correctly in a multi-chunk document", () => {
    const pages = Array.from({ length: 6 }, (_, i) =>
      paragraphs(3).replace(/Paragraph/g, `Page${i}Paragraph`),
    );
    const { text, pageSpans } = joinPages(pages);
    const chunks = chunkText(text, pageSpans);

    for (const chunk of chunks) {
      const expected = pageSpans.findLast(
        (s) => s.charStart <= chunk.charStart,
      );
      expect(chunk.pageNumber).toBe(expected!.pageNumber);
    }
  });

  it("leaves the page null when the format has no pages", () => {
    for (const chunk of chunkText(paragraphs(6), null)) {
      expect(chunk.pageNumber).toBeNull();
    }
  });
});

describe("chunkText — limits", () => {
  it("refuses a document that would exceed the chunk ceiling", () => {
    // One pathological upload should not consume a day of embedding quota.
    const enormous = paragraphs(MAX_CHUNKS_PER_DOCUMENT * 2);

    expect(() => chunkText(enormous)).toThrow(DocumentTooLargeError);
    expect(() => chunkText(enormous)).toThrow(/above the limit of 600/);
  });
});
