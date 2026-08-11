import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_EMBEDDING_DIMENSIONS,
  ingestLocalFile,
  type IngestResult,
} from "./ingest";
import { getLocalDocument, listLocalChunks } from "./store";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const aFile = (name = "handbook.pdf", type = "application/pdf") =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

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
    // The citation invariant: a local passage has to resolve by the same offsets
    // a cloud one does, or "the same citation path" is not true.
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

  it("refuses an unsupported type before starting a worker", async () => {
    const parse = parsedAs({ ok: true, pageCount: null, chunks: [] });

    const result = await ingestLocalFile(
      aFile("photo.png", "image/png"),
      parse,
    );

    expect(result).toMatchObject({
      ok: false,
      message: /Unsupported file type/,
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it("names the browser's empty type rather than printing nothing", async () => {
    const result = await ingestLocalFile(aFile("mystery", ""), twoChunks);

    expect(result).toMatchObject({ message: /unknown/ });
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
