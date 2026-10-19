import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHUNK_MAX_CHARS,
  CHUNK_TARGET_CHARS,
  DocumentTooLargeError,
  MAX_CHUNKS_PER_DOCUMENT,
  chunkText,
} from "./chunking";
import { extractText } from "./extract";
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
    // Two paragraphs: one is the only input that never needs merging.
    const text = "Short enough to stay whole.\n\nAnd so is this.";
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(text);
    expect(chunks[0]!.charStart).toBe(0);
  });

  it("merges short paragraphs up to the target after the first chunk too", () => {
    // The merge measures from where the chunk starts, and only the first chunk
    // starts at zero.
    const text = Array.from(
      { length: 80 },
      (_, i) => `Short paragraph ${i}.`,
    ).join("\n\n");
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.content.length).toBeGreaterThan(CHUNK_TARGET_CHARS / 2);
    }
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
    // A paragraph of spaces, flushed alone because the next is too long to
    // merge. A run of newlines never gets here: the paragraph split takes it.
    const long = "Words enough to pass the target on their own. ".repeat(15);
    const chunks = chunkText(`   \n\n${long}`);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.content.trim()).not.toBe("");
    }
  });

  it("does not start or end a chunk on whitespace", () => {
    // On the text's own edges: separators between paragraphs are consumed by
    // the split, so they never needed trimming.
    const text = `   ${paragraphs(10)}  `;
    const chunks = chunkText(text);

    expect(chunks[0]!.charStart).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.content).toBe(chunk.content.trim());
    }
    expectSliceInvariant(text, chunks);
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
    // An arbitrary cut also stays under the maximum; only the sentence ends
    // tell them apart. After a short paragraph, so the split has to stay
    // inside its own range.
    const sentence = "This sentence is a unit that should survive intact. ";
    const oversized = sentence.repeat(
      Math.ceil(CHUNK_MAX_CHARS / sentence.length) + 5,
    );
    const text = `A short paragraph first.\n\n${oversized}`;
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
      expect(chunk.content).toMatch(/\.$/);
    }
    expectSliceInvariant(text, chunks);
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
    // "passages", not "chunks": the word the documents list and the usage page
    // use. Only the number was pinned, so the noun regressed silently once.
    expect(() => chunkText(enormous)).toThrow(
      /passages, above the limit of 600/,
    );
  });

  it("allows exactly the ceiling, which the refusal says is not above it", () => {
    // An unbroken run cuts into pieces of exactly CHUNK_MAX_CHARS with no room
    // for overlap, so the count is known before chunking.
    const chunks = chunkText(
      "z".repeat(CHUNK_MAX_CHARS * MAX_CHUNKS_PER_DOCUMENT),
    );

    expect(chunks).toHaveLength(MAX_CHUNKS_PER_DOCUMENT);
  });
});

describe("chunkText — other sizes, for measuring them", () => {
  const small = { target: 200, max: 300, overlap: 30 };

  it("keeps the slice invariant and its own maximum", () => {
    // Paragraphs longer than 300, and an unbroken run, so the maximum binds.
    const text = `${paragraphs(4)}\n\n${"x".repeat(700)}`;
    const chunks = chunkText(text, null, small);

    expectSliceInvariant(text, chunks);
    expect(Math.max(...chunks.map((chunk) => chunk.content.length))).toBe(300);
  });

  describe("each size is inclusive", () => {
    const tiny = { target: 20, max: 30, overlap: 5 };
    const cuts = (text: string) =>
      chunkText(text, null, tiny).map((chunk) => [
        chunk.charStart,
        chunk.charEnd,
      ]);

    it("keeps a paragraph exactly the maximum long whole", () => {
      expect(cuts(`${"a ".repeat(14)}aa`)).toEqual([[0, 30]]);
    });

    it("joins paragraphs that reach the target exactly", () => {
      expect(cuts(`${"a".repeat(9)}\n\n${"b".repeat(9)}`)).toEqual([[0, 20]]);
    });

    it("keeps the overlap when it brings a chunk exactly to the maximum", () => {
      expect(cuts(`${"a".repeat(13)} bb\n\n${"c".repeat(26)}`)).toEqual([
        [0, 16],
        [14, 44],
      ]);
    });
  });

  it("cuts differently from the shipped sizes", () => {
    const text = paragraphs(4);

    expect(chunkText(text, null, small).length).toBeGreaterThan(
      chunkText(text).length,
    );
  });
});

describe("chunkText — the shipped sizes, pinned", () => {
  // Every measured number — the floor, recall, the answer report — was taken on
  // these cuts. A change to them is a re-measurement, not a refactor.
  const SHIPPED: Record<string, [number, number][]> = {
    "meridian-support-policy.md": [
      [0, 462],
      [366, 962],
      [870, 1453],
      [1363, 1704],
      [1609, 2011],
      [1919, 2428],
      [2333, 2908],
      [2811, 3307],
    ],
    "harbourline-equipment-manual.md": [
      [0, 597],
      [503, 890],
      [797, 1283],
      [1190, 1743],
      [1649, 2186],
      [2094, 2666],
      [2574, 3080],
      [2984, 3281],
    ],
    "larkfield-tenancy-agreement.md": [
      [0, 410],
      [317, 844],
      [755, 1178],
      [1081, 1468],
      [1377, 1890],
      [1797, 2290],
      [2197, 2630],
      [2533, 2920],
      [2826, 3176],
    ],
  };

  for (const [file, boundaries] of Object.entries(SHIPPED)) {
    it(`cuts ${file} where every measurement was taken`, async () => {
      const bytes = readFileSync(
        join(import.meta.dirname, "..", "..", "eval", "fixtures", file),
      );
      const { text, pageSpans } = await extractText(
        new Uint8Array(bytes),
        "text/markdown",
      );

      expect(
        chunkText(text, pageSpans).map((chunk) => [
          chunk.charStart,
          chunk.charEnd,
        ]),
      ).toEqual(boundaries);
    });
  }
});
