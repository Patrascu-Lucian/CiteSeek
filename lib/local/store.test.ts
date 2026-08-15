import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DATABASE_VERSION,
  RE_INGEST_REQUIRED,
  deleteEverythingLocal,
  deleteLocalDocument,
  getLocalDocument,
  listLocalChunks,
  listLocalDocuments,
  putLocalChunks,
  putLocalDocument,
  markLocalDocumentFailed,
  setLocalEmbeddings,
  summarizeLocalStore,
  type LocalChunk,
  type LocalDocument,
} from "./store";

const DIMENSIONS = 384;

const aDocument = (overrides: Partial<LocalDocument> = {}): LocalDocument => ({
  id: "doc-1",
  filename: "handbook.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  status: "ready",
  error: null,
  text: "stored document text",
  pageCount: 3,
  chunkCount: 0,
  embeddingDimensions: DIMENSIONS,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const aChunk = (overrides: Partial<LocalChunk> = {}): LocalChunk => ({
  id: "chunk-1",
  documentId: "doc-1",
  index: 0,
  text: "Reimbursement is paid within 30 days.",
  page: 1,
  startOffset: 0,
  endOffset: 37,
  embedding: Array<number>(DIMENSIONS).fill(0.1),
  ...overrides,
});

beforeEach(() => {
  // A fresh factory per test, because the database is module-level state and
  // one test's documents would otherwise be another's starting point.
  globalThis.indexedDB = new IDBFactory();
});

describe("the local store", () => {
  it("round-trips a document", async () => {
    await putLocalDocument(aDocument());

    expect(await getLocalDocument("doc-1")).toMatchObject({
      filename: "handbook.pdf",
      embeddingDimensions: DIMENSIONS,
    });
  });

  it("returns nothing for a document that was never stored", async () => {
    expect(await getLocalDocument("missing")).toBeUndefined();
  });

  it("lists documents newest first", async () => {
    await putLocalDocument(aDocument({ id: "old", createdAt: 1 }));
    await putLocalDocument(aDocument({ id: "new", createdAt: 2 }));

    expect((await listLocalDocuments()).map((d) => d.id)).toEqual([
      "new",
      "old",
    ]);
  });

  it("returns chunks in document order, not insertion order", async () => {
    await putLocalDocument(aDocument());
    await putLocalChunks("doc-1", [
      aChunk({ id: "c2", index: 1 }),
      aChunk({ id: "c1", index: 0 }),
    ]);

    expect((await listLocalChunks("doc-1")).map((c) => c.id)).toEqual([
      "c1",
      "c2",
    ]);
  });

  it("only returns the requested document's chunks", async () => {
    await putLocalDocument(aDocument({ id: "a" }));
    await putLocalDocument(aDocument({ id: "b" }));
    await putLocalChunks("a", [aChunk({ id: "a1", documentId: "a" })]);
    await putLocalChunks("b", [aChunk({ id: "b1", documentId: "b" })]);

    expect((await listLocalChunks("a")).map((c) => c.id)).toEqual(["a1"]);
  });

  it("refuses a vector of the wrong width", async () => {
    // Cosine similarity over mismatched dimensions returns a number rather than
    // throwing, so this is the only place the mistake is still visible.
    await putLocalDocument(aDocument());

    await expect(
      putLocalChunks("doc-1", [aChunk({ embedding: [0.1, 0.2] })]),
    ).rejects.toThrow(/2 dimensions, expected 384/);

    expect(await listLocalChunks("doc-1")).toEqual([]);
  });

  it("refuses chunks for a document that does not exist", async () => {
    await expect(putLocalChunks("ghost", [aChunk()])).rejects.toThrow(/ghost/);
  });

  describe("deleting one document", () => {
    it("takes its chunks with it, since IndexedDB has no cascade", async () => {
      await putLocalDocument(aDocument());
      await putLocalChunks("doc-1", [aChunk(), aChunk({ id: "chunk-2" })]);

      await deleteLocalDocument("doc-1");

      expect(await getLocalDocument("doc-1")).toBeUndefined();
      expect(await summarizeLocalStore()).toEqual({
        documents: 0,
        chunks: 0,
        filenames: [],
      });
    });

    it("leaves every other document's chunks alone", async () => {
      await putLocalDocument(aDocument({ id: "a" }));
      await putLocalDocument(aDocument({ id: "b" }));
      await putLocalChunks("a", [aChunk({ id: "a1", documentId: "a" })]);
      await putLocalChunks("b", [aChunk({ id: "b1", documentId: "b" })]);

      await deleteLocalDocument("a");

      expect(await summarizeLocalStore()).toEqual({
        documents: 1,
        chunks: 1,
        filenames: ["handbook.pdf"],
      });
      expect((await listLocalChunks("b")).map((c) => c.id)).toEqual(["b1"]);
    });
  });

  describe("deleting everything", () => {
    it("leaves nothing recoverable", async () => {
      // The local half of the cascade test the server has: the claim on the
      // privacy page is that this is real, not that the list looks empty.
      await putLocalDocument(aDocument({ id: "a" }));
      await putLocalDocument(aDocument({ id: "b" }));
      await putLocalChunks("a", [aChunk({ id: "a1", documentId: "a" })]);
      await putLocalChunks("b", [aChunk({ id: "b1", documentId: "b" })]);

      await deleteEverythingLocal();

      expect(await listLocalDocuments()).toEqual([]);
      expect(await listLocalChunks("a")).toEqual([]);
      expect(await listLocalChunks("b")).toEqual([]);
      expect(await summarizeLocalStore()).toEqual({
        documents: 0,
        chunks: 0,
        filenames: [],
      });
    });

    it("clears every store the database has, not a hardcoded list", async () => {
      // Guards the one thing that would rot silently: a store added in a later
      // version, missing from a written-out list, surviving "delete everything".
      await putLocalDocument(aDocument());
      await putLocalChunks("doc-1", [aChunk()]);

      await deleteEverythingLocal();

      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("citeseek-local");
        request.onsuccess = () => resolve(request.result);
      });
      const names = Array.from(database.objectStoreNames);
      const counts = await Promise.all(
        names.map(
          (name) =>
            new Promise<number>((resolve) => {
              const request = database
                .transaction(name, "readonly")
                .objectStore(name)
                .count();
              request.onsuccess = () => resolve(request.result);
            }),
        ),
      );
      database.close();

      expect(names.length).toBeGreaterThan(1);
      expect(counts).toEqual(names.map(() => 0));
    });

    it("is safe to call when there is nothing stored", async () => {
      await expect(deleteEverythingLocal()).resolves.toBeUndefined();
    });
  });

  it("fails rather than opening a database newer than this build", async () => {
    // A reader who used a later version of the app and then got a rollback.
    // IndexedDB refuses to open at a lower version than the stored one, and the
    // rejection has to carry the reason rather than a bare `null`.
    await new Promise<void>((resolve) => {
      const request = indexedDB.open("citeseek-local", DATABASE_VERSION + 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("documents", { keyPath: "id" });
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });

    await expect(listLocalDocuments()).rejects.toThrow(/IndexedDB request/);
  });

  it("names the missing capability rather than throwing a DOM error", async () => {
    // Private browsing in some engines, and every server render. The gate on
    // /local checks WebGPU; this is the other thing that can be absent.
    // @ts-expect-error deleting a global the DOM types declare as present
    delete globalThis.indexedDB;

    await expect(listLocalDocuments()).rejects.toThrow(/no IndexedDB/);
  });

  it("survives a second open, which is what outliving a sign-out means", async () => {
    // Nothing clears this store on sign-out, so the privacy page has to say it
    // belongs to the browser profile rather than to an account.
    await putLocalDocument(aDocument());

    expect(await summarizeLocalStore()).toEqual({
      documents: 1,
      chunks: 0,
      filenames: ["handbook.pdf"],
    });
    expect(await getLocalDocument("doc-1")).toBeDefined();
  });
});

describe("setLocalEmbeddings", () => {
  it("refuses to mark a document ready with a passage left unembedded", async () => {
    // The failure this function exists to prevent: `ready` is a promise that
    // every passage can be retrieved, and a missing vector silently breaks it.
    await putLocalDocument(aDocument({ status: "processing" }));
    await putLocalChunks("doc-1", [aChunk({ id: "c1" }), aChunk({ id: "c2" })]);

    await expect(
      setLocalEmbeddings(
        "doc-1",
        new Map([["c1", Array<number>(DIMENSIONS).fill(0.1)]]),
      ),
    ).rejects.toThrow(/1 of 2 passages have no embedding/);

    // Still `processing`, not `ready`: the whole write is one transaction.
    expect((await getLocalDocument("doc-1"))?.status).toBe("processing");
  });

  it("refuses a document that does not exist", async () => {
    await expect(setLocalEmbeddings("ghost", new Map())).rejects.toThrow(
      /ghost/,
    );
  });
});

describe("setLocalEmbeddings, against a store that changed underneath it", () => {
  it("does not resurrect a document deleted while it was embedding", async () => {
    /*
      Embedding takes tens of seconds and "Delete everything" stays enabled the
      whole time. Reading the document before the transaction and writing that
      snapshot back afterwards would restore it as `ready` with no passages —
      a searchable document made of nothing, next to a panel saying the store
      is empty.
    */
    await putLocalDocument(aDocument({ status: "processing" }));
    await putLocalChunks("doc-1", [aChunk({ id: "c1" })]);
    const embeddings = new Map([["c1", Array<number>(DIMENSIONS).fill(0.1)]]);

    await deleteEverythingLocal();

    await expect(setLocalEmbeddings("doc-1", embeddings)).rejects.toThrow(
      /doc-1/,
    );
    expect(await listLocalDocuments()).toEqual([]);
  });

  it("refuses a vector of the wrong width", async () => {
    // The guard `putLocalChunks` carries. This is now the only path that
    // actually stores a vector, so losing it here loses it entirely.
    await putLocalDocument(aDocument({ status: "processing" }));
    await putLocalChunks("doc-1", [aChunk({ id: "c1" })]);

    await expect(
      setLocalEmbeddings("doc-1", new Map([["c1", [0.1, 0.2]]])),
    ).rejects.toThrow(/does not have 384 dimensions/);

    expect((await getLocalDocument("doc-1"))?.status).toBe("processing");
  });
});

describe("markLocalDocumentFailed", () => {
  it("records why, so a stuck document is visible rather than silent", async () => {
    await putLocalDocument(aDocument({ status: "processing" }));

    await markLocalDocumentFailed("doc-1", "The model could not be loaded.");

    expect(await getLocalDocument("doc-1")).toMatchObject({
      status: "failed",
      error: "The model could not be loaded.",
    });
  });

  it("says nothing about a document that is already gone", async () => {
    await expect(
      markLocalDocumentFailed("ghost", "whatever"),
    ).resolves.toBeUndefined();
  });
});

describe("opening a store written by version 1", () => {
  /** Version 1 had no `text` field. Building the old schema by hand is the only
   * way to prove the upgrade path, since the store only ever writes the new one. */
  const writeVersionOne = (document: Record<string, unknown>) =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("citeseek-local", 1);

      request.onupgradeneeded = () => {
        const database = request.result;

        database.createObjectStore("documents", { keyPath: "id" });
        database
          .createObjectStore("chunks", { keyPath: "id" })
          .createIndex("documentId", "documentId", { unique: false });
      };

      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("documents", "readwrite");

        transaction.objectStore("documents").put(document);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () =>
          reject(new Error("Writing the version 1 fixture failed."));
      };

      request.onerror = () =>
        reject(new Error("Opening the version 1 fixture failed."));
    });

  it("fails a document that has no text, rather than letting it be cited", async () => {
    // It would otherwise retrieve and be cited, and only then would the panel
    // report the passage missing — the guarantee failing after the claim.
    const { text: _text, ...withoutText } = aDocument();
    await writeVersionOne(withoutText);

    expect(await getLocalDocument("doc-1")).toMatchObject({
      status: "failed",
      error: RE_INGEST_REQUIRED,
    });
  });

  it("keeps the document readable, so the reader can still delete it", async () => {
    const { text: _text, ...withoutText } = aDocument();
    await writeVersionOne(withoutText);

    expect(await listLocalDocuments()).toHaveLength(1);
  });

  it("leaves the chunk index in place across the upgrade", async () => {
    const { text: _text, ...withoutText } = aDocument();
    await writeVersionOne(withoutText);
    await putLocalChunks("doc-1", [aChunk()]);

    expect(await listLocalChunks("doc-1")).toHaveLength(1);
  });
});
