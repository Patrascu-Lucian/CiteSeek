import { describe, expect, it } from "vitest";

import { answerAsText } from "./answer-text";
import type { ChatSource } from "./types";

/** Empty unless a test is about the excerpt, so the list's other rules are
 * pinned without it. */
const source = (
  marker: number,
  filename: string,
  pageNumber: number | null = null,
  quote = "",
): ChatSource => ({
  marker,
  filename,
  pageNumber,
  chunkId: `chunk-${String(marker)}`,
  documentId: "doc",
  charStart: 0,
  charEnd: 10,
  quote,
});

describe("answerAsText", () => {
  it("keeps the markers and says what each one was", () => {
    const text = answerAsText(
      "The deposit is £1,200 [1], protected within 30 days [2].",
      [source(1, "tenancy.pdf", 3), source(2, "tenancy.pdf", 4)],
    );

    expect(text).toBe(
      "The deposit is £1,200 [1], protected within 30 days [2].\n\n" +
        "Sources:\n[1] tenancy.pdf, page 3\n[2] tenancy.pdf, page 4",
    );
  });

  it("lists only what the answer cited, not everything retrieved", () => {
    // Eight passages are sent per question; the seven an answer did not use
    // would read as padding on a document the reader is pasting into.
    const text = answerAsText("Only the first one matters [1].", [
      source(1, "one.md"),
      source(2, "two.md"),
      source(3, "three.md"),
    ]);

    expect(text).toContain("[1] one.md");
    expect(text).not.toContain("two.md");
    expect(text).not.toContain("three.md");
  });

  it("omits a page number the document does not have", () => {
    // Markdown and text files have no pages, and "page null" is worse than no
    // page at all. Pinned whole: a `toContain` and a missing "page" also passed
    // with the empty branch replaced by any other word.
    const text = answerAsText("A claim [1].", [source(1, "notes.md")]);

    expect(text).toBe("A claim [1].\n\nSources:\n[1] notes.md");
  });

  it("keeps the marker's own number instead of renumbering from one", () => {
    // An answer can cite [2] without citing [1], and the number in the prose is
    // the only thing tying them together.
    const text = answerAsText("Second only [2].", [
      source(1, "a.md"),
      source(2, "b.md"),
    ]);

    expect(text).toContain("[2] b.md");
    expect(text).not.toContain("[1]");
  });

  it("lists the cited sources in marker order, whatever order they arrive in", () => {
    // Out of order on purpose: one source after the filter sorts the same
    // however the comparator behaves, so dropping or breaking it survived.
    const text = answerAsText("Both [1] and [2].", [
      source(2, "second.md", 7),
      source(1, "first.md"),
    ]);

    expect(text).toBe(
      "Both [1] and [2].\n\nSources:\n[1] first.md\n[2] second.md, page 7",
    );
  });

  it("trims the answer, so a pasted block opens on the prose", () => {
    // Streamed text arrives with trailing newlines.
    const text = answerAsText("\n  A claim [1].  \n\n", [
      source(1, "notes.md"),
    ]);

    expect(text).toBe("A claim [1].\n\nSources:\n[1] notes.md");
  });

  it("returns a refusal as itself, with no empty heading under it", () => {
    // A refusal cites nothing, and "Sources:" followed by nothing reads as a
    // failure to load rather than as an answer.
    expect(answerAsText("The documents do not cover parking.", [])).toBe(
      "The documents do not cover parking.",
    );
  });

  // The clipboard follows the screen: what the page refused to link, a paste
  // must not list, and the note the page shows travels with it (ADR 058).
  describe("what the page did with the markers", () => {
    const two = [source(1, "a.pdf", 2), source(2, "b.pdf", 5)];

    it("lists every marker when all of them linked", () => {
      expect(answerAsText("One [1] and two [2].", two)).toBe(
        "One [1] and two [2].\n\nSources:\n[1] a.pdf, page 2\n[2] b.pdf, page 5",
      );
    });

    it("carries the invented-marker note, and lists only the real one", () => {
      expect(answerAsText("Real [1], invented [7].", two)).toBe(
        "Real [1], invented [7].\n\n" +
          "[7] is not one of the passages found, so it is not a link. Treat that claim as unsupported.\n\n" +
          "Sources:\n[1] a.pdf, page 2",
      );
    });

    it("lists nothing from a run the page left unlinked", () => {
      // `[1][7]` is all or nothing on screen, so neither is a chip there.
      expect(answerAsText("Mixed [1][7], then [2].", two)).toBe(
        "Mixed [1][7], then [2].\n\n" +
          "[7] is not one of the passages found, so it is not a link. Treat that claim as unsupported.\n\n" +
          "Sources:\n[2] b.pdf, page 5",
      );
    });

    it("lists nothing for a declining reply, and says why", () => {
      expect(
        answerAsText(
          "The documents do not cover the warranty; they mention the guard [1][2].",
          two,
        ),
      ).toBe(
        "The documents do not cover the warranty; they mention the guard [1][2].\n\n" +
          "This reply declines the question, so its markers are not links.",
      );
    });

    it("adds nothing to a declining reply with no markers", () => {
      expect(answerAsText("The documents do not cover parking.", two)).toBe(
        "The documents do not cover parking.",
      );
    });
  });

  // Three markers on one page read "page 1" three times; the start of each
  // passage is what tells a reader which one a marker meant.
  describe("telling passages on one page apart", () => {
    it("gives each listed source the start of its passage", () => {
      const text = answerAsText("Paid [1], within 30 days [2].", [
        source(1, "handbook.pdf", 1, "Reimbursement is paid through payroll."),
        source(2, "handbook.pdf", 1, "Claims are paid within 30 days."),
      ]);

      expect(text).toBe(
        "Paid [1], within 30 days [2].\n\nSources:\n" +
          "[1] handbook.pdf, page 1 — “Reimbursement is paid through payroll.”\n" +
          "[2] handbook.pdf, page 1 — “Claims are paid within 30 days.”",
      );
    });

    it("cuts a long passage at a word, and keeps a word that fits exactly", () => {
      // The 60th character ends "claim," and the 61st is a space, so the whole
      // word fits; backing up to the previous space would drop it.
      const text = answerAsText("Paid [1].", [
        source(
          1,
          "a.pdf",
          null,
          "Expenses are reimbursed within 30 days of an approved claim, and paid through payroll.",
        ),
      ]);

      expect(text).toBe(
        "Paid [1].\n\nSources:\n" +
          "[1] a.pdf — “Expenses are reimbursed within 30 days of an approved claim,…”",
      );
    });

    it("backs up to the last whole word when the cut lands inside one", () => {
      const text = answerAsText("Paid [1].", [
        source(
          1,
          "a.pdf",
          null,
          "Expenses are reimbursed within thirty days of an approved claim.",
        ),
      ]);

      expect(text).toBe(
        "Paid [1].\n\nSources:\n" +
          "[1] a.pdf — “Expenses are reimbursed within thirty days of an approved…”",
      );
    });

    it("collapses the passage's line breaks and runs of spaces", () => {
      const text = answerAsText("Paid [1].", [
        source(1, "a.pdf", null, "  Paid\n\nwithin   30 days. "),
      ]);

      expect(text).toBe(
        "Paid [1].\n\nSources:\n[1] a.pdf — “Paid within 30 days.”",
      );
    });

    it("leaves a passage of exactly the limit whole", () => {
      const sixty = `${"word ".repeat(11)}words`;

      expect([...sixty]).toHaveLength(60);
      expect(answerAsText("Paid [1].", [source(1, "a.pdf", null, sixty)])).toBe(
        `Paid [1].\n\nSources:\n[1] a.pdf — “${sixty}”`,
      );
    });

    it("cuts a word longer than the limit where the limit falls", () => {
      // No space to back up to: the cut itself is the excerpt.
      const text = answerAsText("Paid [1].", [
        source(1, "a.pdf", null, "a".repeat(70)),
      ]);

      expect(text).toBe(
        `Paid [1].\n\nSources:\n[1] a.pdf — “${"a".repeat(60)}…”`,
      );
    });

    it("never halves a character built from several code points", () => {
      // At the cut: a ZWJ family, a flag, a skin tone and a decomposed "é".
      // Cut by code point, each lost its second half.
      for (const whole of ["👨‍👩‍👧", "🇬🇧", "👍🏽", "é"]) {
        const text = answerAsText("Paid [1].", [
          source(1, "a.pdf", null, `${"a".repeat(59)}${whole}bbbb`),
        ]);

        expect(text).toBe(
          `Paid [1].\n\nSources:\n[1] a.pdf — “${"a".repeat(59)}${whole}…”`,
        );
      }
    });

    it("never halves a character that takes two code units", () => {
      // Sliced by UTF-16 units, the 60th code point here would be cut in two.
      const text = answerAsText("Paid [1].", [
        source(1, "a.pdf", null, `${"a".repeat(59)}😀 and more`),
      ]);

      expect(text).toBe(
        `Paid [1].\n\nSources:\n[1] a.pdf — “${"a".repeat(59)}😀…”`,
      );
    });
  });
});
