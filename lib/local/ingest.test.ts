import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCAL_EMBEDDING_DIMENSIONS } from "./embedder";
import { ingestLocalFile, type IngestResult } from "./ingest";
import { getLocalDocument, listLocalChunks } from "./store";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Real leading bytes, because `validateUpload` checks that the contents agree
 * with the extension. */
const MAGIC: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
  docx: [0x50, 0x4b, 0x03, 0x04],
};

const aFile = (name = "handbook.pdf", type = "application/pdf") =>
  new File(
    [new Uint8Array(MAGIC[name.split(".").pop()!] ?? [0x68, 0x69])],
    name,
    { type },
  );

const parsedAs = (result: IngestResult) => vi.fn().mockResolvedValue(result);

const twoChunks = parsedAs({
  ok: true,
  pageCount: 2,
  chunks: [
    {
      chunkIndex: 0,
      content: "Reimbursement is paid within 30 days.",
      charStart: 0,
      charEnd: 37,
      pageNumber: 1,
    },
    {
      chunkIndex: 1,
      content: "Expenses need a receipt.",
      charStart: 38,
      charEnd: 62,
      pageNumber: 2,
    },
  ],
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("ingestLocalFile", () => {
  it("stores the document and its passages", async () => {
    const result = await ingestLocalFile(aFile(), twoChunks);

    expect(result.ok).toBe(true);
    const chunks = await listLocalChunks(result.ok ? result.document.id : "");
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "Reimbursement is paid within 30 days.",
      "Expenses need a receipt.",
    ]);
  });

  it("keeps the offsets the chunker produced", async () => {
    // Half the citation invariant. Resolving one also needs the canonical text
    // these index into, which local mode does not store yet — see the backlog.
    const result = await ingestLocalFile(aFile(), twoChunks);
    const [first] = await listLocalChunks(result.ok ? result.document.id : "");

    expect(first).toMatchObject({ startOffset: 0, endOffset: 37, page: 1 });
  });

  it("leaves the document unsearchable until vectors exist", async () => {
    // `ready` would be a lie: nothing can answer a question from these yet.
    const result = await ingestLocalFile(aFile(), twoChunks);
    const stored = await getLocalDocument(result.ok ? result.document.id : "");

    expect(stored?.status).toBe("processing");
    expect(stored?.embeddingDimensions).toBe(LOCAL_EMBEDDING_DIMENSIONS);
  });

  it("writes chunks with no embedding rather than a zero vector", async () => {
    // A zero vector is a valid input to cosine similarity and would rank as a
    // real passage. Null cannot be mistaken for one.
    const result = await ingestLocalFile(aFile(), twoChunks);
    const chunks = await listLocalChunks(result.ok ? result.document.id : "");

    expect(chunks.every((chunk) => chunk.embedding === null)).toBe(true);
  });

  it("accepts a Word document, which is the format that needed the Buffer fix", async () => {
    const result = await ingestLocalFile(aFile("notes.docx", DOCX), twoChunks);

    expect(result.ok).toBe(true);
  });

  it("refuses an unsupported extension before parsing", async () => {
    const parse = parsedAs({ ok: true, pageCount: null, chunks: [] });

    const result = await ingestLocalFile(
      aFile("photo.png", "image/png"),
      parse,
    );

    expect(result).toMatchObject({
      ok: false,
      message: /.png files are not supported/,
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it("names a file with no extension rather than printing nothing", async () => {
    const result = await ingestLocalFile(aFile("mystery", ""), twoChunks);

    expect(result).toMatchObject({
      message: /Files without an extension/,
    });
  });

  it("trusts the extension and bytes, not the type the browser reported", async () => {
    // `File.type` is derived from the extension by the OS, so on some machines a
    // .md file arrives with an empty type. Refusing it would reject a file the
    // picker itself offered.
    const markdown = new File(
      [new TextEncoder().encode("# Notes")],
      "notes.md",
      {
        type: "",
      },
    );

    const parse = vi.fn().mockResolvedValue({
      ok: true,
      pageCount: null,
      chunks: [],
    });
    const result = await ingestLocalFile(markdown, parse);

    expect(result.ok).toBe(true);
    expect(parse).toHaveBeenCalledWith(markdown, "text/markdown");
  });

  it("refuses a file above the upload ceiling", async () => {
    const huge = new File([new Uint8Array(MAGIC.pdf!)], "huge.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(huge, "size", { value: 5 * 1024 * 1024 });

    expect(await ingestLocalFile(huge, twoChunks)).toMatchObject({
      ok: false,
      message: /too large|4 MB/i,
    });
  });

  it("stores nothing when parsing fails", async () => {
    const result = await ingestLocalFile(
      aFile(),
      parsedAs({ ok: false, message: "This PDF needs OCR." }),
    );

    expect(result).toMatchObject({ ok: false, message: "This PDF needs OCR." });
    expect(await listLocalChunks("any")).toEqual([]);
  });
});

describe("when the browser will not store anything", () => {
  it("reports it instead of rejecting", async () => {
    // Firefox private browsing, or a profile at its quota. A rejection here
    // leaves the upload showing "Parsing…" forever, with no error and no retry.
    const indexedDb = globalThis.indexedDB;
    // @ts-expect-error removing a global the DOM types declare as present
    delete globalThis.indexedDB;

    try {
      const result = await ingestLocalFile(aFile(), twoChunks);

      expect(result).toMatchObject({ ok: false, message: /no IndexedDB/i });
    } finally {
      globalThis.indexedDB = indexedDb;
    }
  });
});

describe("the real parser, not an injected one", () => {
  it("shows an unreadable file's own explanation", async () => {
    // Every other test here injects a parser, so this is the only one that runs
    // `extractText` — and the only one that proves the message a reader sees on
    // a corrupt file is the parser's, not a generic fallback.
    const corrupt = new File(
      [new TextEncoder().encode("%PDF-1.4 then garbage")],
      "broken.pdf",
      { type: "application/pdf" },
    );

    expect(await ingestLocalFile(corrupt)).toMatchObject({
      ok: false,
      message: /could not be read|needs OCR/i,
    });
  });

  it("parses a real Markdown file end to end", async () => {
    const notes = new File(
      [new TextEncoder().encode("# Reimbursement\n\nPaid within 30 days.")],
      "notes.md",
      { type: "text/markdown" },
    );

    const result = await ingestLocalFile(notes);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const chunks = await listLocalChunks(result.document.id);
      expect(chunks[0]?.text).toContain("Paid within 30 days.");
    }
  });
});
