import { describe, expect, it } from "vitest";

import { answerAsText } from "./answer-text";
import type { ChatSource } from "./types";

const source = (
  marker: number,
  filename: string,
  pageNumber: number | null = null,
): ChatSource => ({
  marker,
  filename,
  pageNumber,
  chunkId: `chunk-${String(marker)}`,
  documentId: "doc",
  charStart: 0,
  charEnd: 10,
  quote: "…",
});

describe("answerAsText", () => {
  it("keeps the markers and says what each one was", () => {
    const text = answerAsText(
      "The deposit is £1,200 [1], protected within 30 days [2].",
      [source(1, "tenancy.pdf", 3), source(2, "tenancy.pdf", 4)],
      [1, 2],
    );

    expect(text).toBe(
      "The deposit is £1,200 [1], protected within 30 days [2].\n\n" +
        "Sources:\n[1] tenancy.pdf, page 3\n[2] tenancy.pdf, page 4",
    );
  });

  it("lists only what the answer cited, not everything retrieved", () => {
    // Eight passages are sent per question; the seven an answer did not use
    // would read as padding on a document the reader is pasting into.
    const text = answerAsText(
      "Only the first one matters [1].",
      [source(1, "one.md"), source(2, "two.md"), source(3, "three.md")],
      [1],
    );

    expect(text).toContain("[1] one.md");
    expect(text).not.toContain("two.md");
    expect(text).not.toContain("three.md");
  });

  it("omits a page number the document does not have", () => {
    // Markdown and text files have no pages, and "page null" is worse than no
    // page at all.
    const text = answerAsText("A claim [1].", [source(1, "notes.md")], [1]);

    expect(text).toContain("[1] notes.md");
    expect(text).not.toContain("page");
  });

  it("numbers the list by the marker rather than by position", () => {
    // An answer can cite [2] without citing [1], and the number in the prose is
    // the only thing tying them together.
    const text = answerAsText(
      "Second only [2].",
      [source(1, "a.md"), source(2, "b.md")],
      [2],
    );

    expect(text).toContain("[2] b.md");
    expect(text).not.toContain("[1]");
  });

  it("returns a refusal as itself, with no empty heading under it", () => {
    // A refusal cites nothing, and "Sources:" followed by nothing reads as a
    // failure to load rather than as an answer.
    expect(answerAsText("The documents do not cover parking.", [], [])).toBe(
      "The documents do not cover parking.",
    );
  });
});
