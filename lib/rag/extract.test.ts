import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  UnreadableDocumentError,
  extractText,
  isSupportedMimeType,
  mammothInput,
} from "./extract";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("isSupportedMimeType", () => {
  it("accepts the four supported types", () => {
    for (const type of [PDF, DOCX, "text/markdown", "text/plain"]) {
      expect(isSupportedMimeType(type)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const type of ["image/png", "application/zip", "text/html", ""]) {
      expect(isSupportedMimeType(type)).toBe(false);
    }
  });
});

describe("extractText — PDF", () => {
  it("extracts text from every page", async () => {
    const result = await extractText(fixture("sample.pdf"), PDF);

    expect(result.text).toContain("Retrieval augmented generation");
    expect(result.text).toContain("Citations must point");
  });

  it("reports the page count", async () => {
    const result = await extractText(fixture("sample.pdf"), PDF);
    expect(result.pageCount).toBe(2);
  });

  it("returns page spans that index into the extracted text", async () => {
    // The property page-numbered citations depend on. If a span ever stops
    // matching, a citation would name the wrong page with no error anywhere.
    const { text, pageSpans } = await extractText(fixture("sample.pdf"), PDF);

    expect(pageSpans).toHaveLength(2);
    expect(text.slice(pageSpans![0]!.charStart, pageSpans![0]!.charEnd)).toBe(
      "Retrieval augmented generation grounds answers in sources.",
    );
    expect(text.slice(pageSpans![1]!.charStart, pageSpans![1]!.charEnd)).toBe(
      "Citations must point at the exact passage they came from.",
    );
  });

  it("reports a corrupt PDF as unreadable rather than crashing", async () => {
    const notAPdf = new TextEncoder().encode("%PDF-1.4 then garbage");
    // Caught once: PDF.js detaches the bytes, so a second call reads as corrupt.
    const error = await extractText(notAPdf, PDF).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(UnreadableDocumentError);
    expect(error).toHaveProperty("kind", "unreadable");
  });

  it("explains that a text-free PDF probably needs OCR", async () => {
    // A scanned document is the most common real-world case of "upload
    // succeeded, nothing searchable". A real PDF with one empty page: bytes the
    // parser cannot open take the corrupt-file branch and never reach this one.
    const error = await extractText(fixture("blank.pdf"), PDF).catch(
      (cause: unknown) => cause,
    );

    expect(error).toHaveProperty("message", expect.stringMatching(/needs OCR/));
    expect(error).toHaveProperty("kind", "no_text");
  });
});

describe("extractText — docx", () => {
  it("extracts the document text", async () => {
    const result = await extractText(fixture("sample.docx"), DOCX);

    expect(result.text).toContain("Word documents have no page concept");
    expect(result.text).toContain("Pagination happens at render time");
  });

  it("reports no pages rather than inventing page 1", async () => {
    // Word paginates at render time, not in the file. A citation claiming a page
    // number here would assert something unverifiable.
    const result = await extractText(fixture("sample.docx"), DOCX);

    expect(result.pageSpans).toBeNull();
    expect(result.pageCount).toBeNull();
  });

  describe("the options handed to mammoth", () => {
    // Shape only: Node always resolves the Node build, so calling the real
    // parser without `Buffer` fails for a reason production cannot have.
    const bytes = new Uint8Array([1, 2, 3, 4]);

    it("sends the key each build understands", () => {
      expect(Object.keys(mammothInput(bytes)).sort()).toEqual([
        "arrayBuffer",
        "buffer",
      ]);
    });

    it("omits `buffer` where the global does not exist", () => {
      const buffer = globalThis.Buffer;
      // @ts-expect-error removing a global the Node types declare as present
      delete globalThis.Buffer;

      try {
        expect(Object.keys(mammothInput(bytes))).toEqual(["arrayBuffer"]);
      } finally {
        globalThis.Buffer = buffer;
      }
    });

    it("copies the bytes rather than exposing the whole backing buffer", () => {
      // A `Uint8Array` can be a view into a larger buffer. Passing
      // `bytes.buffer` would hand mammoth everything around it.
      const view = new Uint8Array(new ArrayBuffer(16), 4, 4);
      view.set([9, 9, 9, 9]);

      expect(mammothInput(view).arrayBuffer.byteLength).toBe(4);
    });
  });

  it("reports a corrupt docx as unreadable", async () => {
    const notADocx = new TextEncoder().encode("PK but not really a zip");
    const error = await extractText(notADocx, DOCX).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(UnreadableDocumentError);
    expect(error).toHaveProperty("kind", "unreadable");
  });

  it("refuses a Word document with no text", async () => {
    const error = await extractText(fixture("empty.docx"), DOCX).catch(
      (cause: unknown) => cause,
    );

    expect(error).toHaveProperty(
      "message",
      expect.stringMatching(/appears to contain no text/),
    );
    expect(error).toHaveProperty("kind", "no_text");
  });
});

describe("extractText — markdown and plain text", () => {
  it("decodes markdown", async () => {
    const result = await extractText(fixture("sample.md"), "text/markdown");

    expect(result.text).toContain("Markdown has no pages either.");
    expect(result.pageSpans).toBeNull();
  });

  it("normalizes line endings", async () => {
    const crlf = new TextEncoder().encode("first\r\n\r\nsecond");
    const result = await extractText(crlf, "text/plain");

    expect(result.text).toBe("first\n\nsecond");
  });

  it("rejects invalid UTF-8 instead of substituting replacement characters", async () => {
    // Silent substitution would corrupt both the text and every offset into it.
    const invalid = new Uint8Array([0xff, 0xfe, 0xfd]);
    const error = await extractText(invalid, "text/plain").catch(
      (cause: unknown) => cause,
    );

    expect(error).toHaveProperty(
      "message",
      expect.stringMatching(/not valid UTF-8/i),
    );
    expect(error).toHaveProperty("kind", "unreadable");
  });

  it("rejects an empty file", async () => {
    const error = await extractText(
      new TextEncoder().encode("   \n\n  "),
      "text/plain",
    ).catch((cause: unknown) => cause);

    expect(error).toHaveProperty("message", expect.stringMatching(/empty/i));
    expect(error).toHaveProperty("kind", "no_text");
  });
});

describe("extractText — unsupported types", () => {
  it("names the supported formats", async () => {
    const error = await extractText(
      new Uint8Array([1, 2, 3]),
      "image/png",
    ).catch((cause: unknown) => cause);

    expect(error).toHaveProperty(
      "message",
      expect.stringMatching(
        /Unsupported file type: image\/png.*PDF.*Markdown/is,
      ),
    );
    expect(error).toHaveProperty("kind", "unreadable");
  });

  it("throws UnreadableDocumentError, not a generic Error", async () => {
    // The pipeline distinguishes "this file is unusable" from "something broke",
    // because only the second is worth retrying.
    await expect(
      extractText(new Uint8Array([1]), "application/zip"),
    ).rejects.toBeInstanceOf(UnreadableDocumentError);
  });
});
