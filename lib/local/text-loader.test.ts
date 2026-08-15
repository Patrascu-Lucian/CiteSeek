import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { putLocalDocument, type LocalDocument } from "./store";
import { localDocumentText } from "./text-loader";

const aDocument = (overrides: Partial<LocalDocument> = {}): LocalDocument => ({
  id: "doc-1",
  filename: "handbook.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  status: "ready",
  error: null,
  text: "Reimbursement is paid within thirty days.",
  pageCount: 1,
  chunkCount: 1,
  embeddingDimensions: 384,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("localDocumentText", () => {
  it("returns the text a citation is resolved against", async () => {
    await putLocalDocument(aDocument());

    expect(await localDocumentText("doc-1")).toEqual({
      status: "loaded",
      contentText: "Reimbursement is paid within thirty days.",
    });
  });

  it("reports a deleted document rather than an error", async () => {
    // A citation outliving its source is expected. The panel then shows the
    // quote it stored, which is why this is not a failure.
    expect(await localDocumentText("gone")).toEqual({
      status: "unavailable",
      reason: "deleted",
    });
  });

  it("distinguishes stored-but-textless from deleted", async () => {
    await putLocalDocument(aDocument({ text: "" }));

    expect(await localDocumentText("doc-1")).toEqual({
      status: "unavailable",
      reason: "no-text",
    });
  });
});
