import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { fakeLocalEmbedding } from "./fake-embedder";
import { retrieveLocally } from "./retrieve";
import {
  putLocalChunks,
  putLocalDocument,
  type LocalChunk,
  type LocalDocument,
} from "./store";

/** Full passages rather than one line each: this embedder counts word overlap,
 * so with three tokens a single hash collision looks like a match. */
const REIMBURSEMENT =
  "Reimbursement is paid within thirty days of approval. Submit the claim " +
  "through the finance portal and a manager approves it before payment runs " +
  "on the last working day of the month.";
const RECEIPTS =
  "Receipts are required for every expense over ten pounds. Photographs of " +
  "paper receipts are accepted provided the total and the date are legible " +
  "in the image you attach to the claim.";

const aDocument = (overrides: Partial<LocalDocument> = {}): LocalDocument => ({
  id: "doc-1",
  filename: "handbook.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  status: "ready",
  error: null,
  pageCount: 2,
  chunkCount: 2,
  embeddingDimensions: 384,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const aChunk = (
  id: string,
  text: string,
  overrides: Partial<LocalChunk> = {},
): LocalChunk => ({
  id,
  documentId: "doc-1",
  index: 0,
  text,
  page: 1,
  startOffset: 0,
  endOffset: text.length,
  embedding: fakeLocalEmbedding(text),
  ...overrides,
});

async function seed(document = aDocument(), chunks?: LocalChunk[]) {
  await putLocalDocument(document);
  await putLocalChunks(
    document.id,
    chunks ?? [
      aChunk("c1", REIMBURSEMENT),
      aChunk("c2", RECEIPTS, { index: 1, page: 2 }),
    ],
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  (globalThis as { __citeseekLocalEmbedder?: string }).__citeseekLocalEmbedder =
    "fake";
});

describe("retrieveLocally", () => {
  it("refuses with `no_documents` when nothing has been added", async () => {
    // A different remedy from "nothing matched": the reader has to upload
    // something before any question can work.
    expect(await retrieveLocally("anything at all")).toEqual({
      sources: [],
      refusal: "no_documents",
    });
  });

  it("treats a document still embedding as not searchable", async () => {
    // `processing` means its passages have no vectors yet. Counting it would
    // report "nothing matched" for a corpus that has not been indexed.
    await seed(aDocument({ status: "processing" }));

    expect(await retrieveLocally("reimbursement")).toMatchObject({
      refusal: "no_documents",
    });
  });

  it("refuses with `no_relevant_passages` when nothing clears the floor", async () => {
    await seed();

    expect(await retrieveLocally("sourdough bread baking")).toMatchObject({
      sources: [],
      refusal: "no_relevant_passages",
    });
  });

  it("cites nothing when it refuses", async () => {
    // The guarantee: a refusal has no sources to hallucinate a citation from,
    // because generation never runs on that branch.
    const result = await retrieveLocally("sourdough bread baking");

    expect(result.sources).toEqual([]);
  });

  it("returns the passage a question is about", async () => {
    await seed();

    const result = await retrieveLocally("reimbursement paid within thirty");

    expect(result.refusal).toBeNull();
    expect(result.sources[0]?.quote).toBe(REIMBURSEMENT);
  });

  it("numbers markers from one, matching the `[n]` a model writes", async () => {
    await seed();

    const { sources } = await retrieveLocally("reimbursement receipts expense");

    expect(sources.map((source) => source.marker)).toEqual(
      sources.map((_, index) => index + 1),
    );
  });

  it("carries the offsets a citation resolves by", async () => {
    // The same fields the server writes, so the source panel highlights a local
    // passage exactly as it highlights a cloud one.
    await seed();

    const { sources } = await retrieveLocally(
      "reimbursement paid within thirty",
    );

    expect(sources[0]).toMatchObject({
      chunkId: "c1",
      documentId: "doc-1",
      filename: "handbook.pdf",
      pageNumber: 1,
      charStart: 0,
      charEnd: REIMBURSEMENT.length,
    });
  });

  it("orders by distance, nearest first", async () => {
    await seed();

    const { sources } = await retrieveLocally(
      "reimbursement paid within thirty",
    );

    expect(sources[0]?.quote).toBe(REIMBURSEMENT);
  });

  it("ignores a passage that has no vector yet", async () => {
    // Half-embedded corpora should not rank; an unembedded passage is simply
    // not searchable rather than infinitely far away.
    await seed(aDocument(), [
      aChunk("c1", REIMBURSEMENT, { embedding: null }),
      aChunk("c2", RECEIPTS, { index: 1 }),
    ]);

    const { sources } = await retrieveLocally(
      "reimbursement paid within thirty",
    );

    expect(sources.map((source) => source.chunkId)).not.toContain("c1");
  });

  it("searches across every ready document", async () => {
    await seed();
    const second = aDocument({ id: "doc-2", filename: "policy.md" });
    await putLocalDocument(second);
    await putLocalChunks("doc-2", [
      aChunk("d2c1", "Expense claims are reviewed monthly.", {
        documentId: "doc-2",
      }),
    ]);

    const { sources } = await retrieveLocally("expense claims reviewed");

    expect(sources.some((source) => source.documentId === "doc-2")).toBe(true);
  });
});
