import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { chunkText } from "./chunking";
import { extractText } from "./extract";
import { highlightForCitation, unwrapForDisplay } from "./highlight";

describe("highlightForCitation", () => {
  const TEXT = "Before it. The cited passage. After it.";
  const CITED = "The cited passage.";
  const START = TEXT.indexOf(CITED);

  it("splits the document around the cited span", () => {
    const highlight = highlightForCitation(TEXT, {
      charStart: START,
      charEnd: START + CITED.length,
      quote: CITED,
    });

    expect(highlight.before).toBe("Before it. ");
    expect(highlight.cited).toBe(CITED);
    expect(highlight.after).toBe(" After it.");
    expect(highlight.matchesQuote).toBe(true);
  });

  it("reassembles into exactly the original document", () => {
    const { before, cited, after } = highlightForCitation(TEXT, {
      charStart: START,
      charEnd: START + CITED.length,
      quote: CITED,
    });

    // Nothing is dropped or duplicated: the reader sees the whole document,
    // with one region marked.
    expect(before + cited + after).toBe(TEXT);
  });

  it("reports a mismatch when the document changed under the citation", () => {
    // Re-uploaded, or re-extracted by a different parser version. The offsets
    // now point somewhere else, and highlighting that confidently would be the
    // worst failure this product has: a precise-looking citation that is wrong.
    const highlight = highlightForCitation("Completely different text here.", {
      charStart: START,
      charEnd: START + CITED.length,
      quote: CITED,
    });

    expect(highlight.matchesQuote).toBe(false);
  });

  it("clamps offsets that run past the end of the text", () => {
    const highlight = highlightForCitation("Short.", {
      charStart: 100,
      charEnd: 200,
      quote: "anything",
    });

    // Truncated text should degrade to an empty highlight, not throw.
    expect(highlight.cited).toBe("");
    expect(highlight.matchesQuote).toBe(false);
    expect(highlight.before).toBe("Short.");
  });

  it("survives a reversed span", () => {
    const highlight = highlightForCitation(TEXT, {
      charStart: 20,
      charEnd: 5,
      quote: "",
    });

    expect(highlight.cited).toBe("");
    expect(highlight.before + highlight.after).toBe(TEXT);
  });

  it("handles a citation at the very start", () => {
    const highlight = highlightForCitation(TEXT, {
      charStart: 0,
      charEnd: 10,
      quote: "Before it.",
    });

    expect(highlight.before).toBe("");
    expect(highlight.matchesQuote).toBe(true);
  });

  it("counts astral characters the way chunking measured them", () => {
    // UTF-16 code units, matching JavaScript string indexing and Postgres text.
    // A byte-based implementation would slice a surrogate pair in half here.
    const text = "Emoji 👋 then the cited bit.";
    const quote = "the cited bit.";
    const start = text.indexOf(quote);

    const highlight = highlightForCitation(text, {
      charStart: start,
      charEnd: start + quote.length,
      quote,
    });

    expect(highlight.cited).toBe(quote);
    expect(highlight.matchesQuote).toBe(true);
  });
});

describe("the citation invariant, end to end", () => {
  it("highlights exactly what the chunker recorded", () => {
    // The chain in one assertion: chunking chooses offsets against the
    // canonical text, ingestion stores that text as contentText, and the panel
    // slices it back out. Every chunk must round-trip.
    const document = [
      "A first paragraph about reimbursement policy and how it works.",
      "A second paragraph covering expenses, receipts and approval limits.",
      "A third paragraph on deadlines, late submissions and exceptions.",
    ].join("\n\n");

    const chunks = chunkText(document);
    expect(chunks.length).toBeGreaterThan(0);

    for (const chunk of chunks) {
      const highlight = highlightForCitation(document, {
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        quote: chunk.content,
      });

      expect(highlight.cited).toBe(chunk.content);
      expect(highlight.matchesQuote).toBe(true);
    }
  });
});

describe("unwrapForDisplay", () => {
  it("joins a line the page broke mid-sentence", () => {
    expect(unwrapForDisplay("Leave\nrequests are approved.")).toBe(
      "Leave requests are approved.",
    );
  });

  it("keeps a break before a capital, a digit or a list marker", () => {
    const text =
      "Time off\nAnnual leave is 28 days.\n- One\n2. Two\n£150 a night";

    expect(unwrapForDisplay(text)).toBe(text);
  });

  it("keeps a blank line, even before a lowercase one", () => {
    const text = "One paragraph.\n\nlowercase opens the next.";

    expect(unwrapForDisplay(text)).toBe(text);
  });

  it("joins before any lowercase letter, not only an ASCII one", () => {
    expect(unwrapForDisplay("Le congé\nécrit")).toBe("Le congé écrit");
  });

  it("changes no length, so stored offsets still index it", () => {
    const text = "Leave\nrequests of five days\nor fewer.\n\nNext.";

    expect(unwrapForDisplay(text)).toHaveLength(text.length);
  });

  it("shows a citation unwrapped, and checks it against the stored text", () => {
    const text = "Before.\nLeave\nrequests are approved.";
    const quote = "Leave\nrequests are approved.";
    const start = text.indexOf(quote);

    const highlight = highlightForCitation(text, {
      charStart: start,
      charEnd: start + quote.length,
      quote,
    });

    expect(highlight.before).toBe("Before.\n");
    expect(highlight.cited).toBe("Leave requests are approved.");
    expect(highlight.matchesQuote).toBe(true);
  });
});

describe("unwrapForDisplay on the documents it will meet", () => {
  const handbook = async () =>
    unwrapForDisplay(
      (
        await extractText(
          new Uint8Array(
            readFileSync(
              join(
                import.meta.dirname,
                "..",
                "db",
                "fixtures",
                "northwind-remote-work-handbook.pdf",
              ),
            ),
          ),
          "application/pdf",
        )
      ).text,
    ).split("\n");

  it("keeps every heading of the demo handbook on its own line", async () => {
    expect(await handbook()).toEqual(
      expect.arrayContaining([
        "Northwind Remote Work Handbook",
        "Expenses and reimbursement",
        "Equipment",
        "Working hours and availability",
        "Time off",
        "Travel",
        "Data handling",
        "Leaving the company",
      ]),
    );
  });

  it("joins the passage the demo's first question cites into one line", async () => {
    expect(await handbook()).toContain(
      "Annual leave is 28 days plus public holidays, and unused leave does not carry over. Leave requests of five days or fewer are approved automatically. Longer requests need a line manager's approval and at least three weeks' notice.",
    );
  });

  it.each([
    "harbourline-equipment-manual.md",
    "larkfield-tenancy-agreement.md",
    "meridian-support-policy.md",
  ])("keeps every heading of %s on its own line", (name) => {
    const text = readFileSync(
      join(import.meta.dirname, "..", "..", "eval", "fixtures", name),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const headings = text.split("\n").filter((line) => /^#{1,6} /.test(line));

    expect(headings.length).toBeGreaterThan(0);
    expect(unwrapForDisplay(text).split("\n")).toEqual(
      expect.arrayContaining(headings),
    );
  });
});
