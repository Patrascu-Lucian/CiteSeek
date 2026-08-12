const DATABASE_NAME = "citeseek-local";
/** Exported so the rollback test opens "one above this build" rather than a
 * literal, which is what silently stopped testing anything at version 2. */
export const DATABASE_VERSION = 2;

/** Version 1 stored no `text`, so its documents cannot resolve a citation: they
 * retrieve, get cited, and the panel then reports the passage missing. Failing
 * them keeps retrieval away from them and tells the reader to re-add. */
export const RE_INGEST_REQUIRED =
  "This document was added before local mode could open a cited passage. Add it again to make its citations resolve.";

const DOCUMENTS = "documents";
const CHUNKS = "chunks";
const CHUNKS_BY_DOCUMENT = "documentId";

export type LocalDocumentStatus = "processing" | "ready" | "failed";

export type LocalDocument = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: LocalDocumentStatus;
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  /** The canonical text every offset indexes into. Stored because a citation is
   * resolved by slicing it — the server keeps `contentText` for the same reason,
   * and offsets without it address a string that does not exist. */
  text: string;
  /**
   * The local model's width, carried per document rather than imported from
   * `EMBEDDING_DIMENSIONS`: that constant is 768 to match the `vector(768)`
   * column, and a model small enough to run in a browser is typically 384.
   */
  embeddingDimensions: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalChunk = {
  id: string;
  documentId: string;
  index: number;
  text: string;
  page: number | null;
  startOffset: number;
  endOffset: number;
  /** Null until embedding runs, mirroring the server, where chunks are inserted
   * first and `setChunkEmbeddings` fills them in afterwards. */
  embedding: number[] | null;
};

/** Anything the local store refused or failed to do. Typed so a caller can tell
 * a storage problem from a model one without matching on message text. */
export class LocalStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LocalStoreError";
  }
}

export class LocalStoreUnavailableError extends LocalStoreError {
  constructor() {
    super(
      "This browser has no IndexedDB, so local mode cannot store anything.",
    );
    this.name = "LocalStoreUnavailableError";
  }
}

function indexedDbOrThrow(): IDBFactory {
  if (typeof indexedDB === "undefined") throw new LocalStoreUnavailableError();

  return indexedDB;
}

/** The `DOMException` goes on `cause` rather than being rejected directly: the
 * DOM types make it nullable, and `error ?? fallback` is a branch that cannot
 * be reached, since an error event always carries one. */
const failed = (what: string, cause: DOMException | null) =>
  new LocalStoreError(`The IndexedDB ${what} failed.`, { cause });

function promise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(failed("request", request.error));
  });
}

/**
 * `getAll` and `get` are typed `any` by the DOM lib, so the cast happens once
 * here rather than at each call site.
 */
const getAll = <T>(source: IDBObjectStore | IDBIndex, query?: IDBValidKey) =>
  promise(source.getAll(query) as IDBRequest<T[]>);

const getOne = <T>(store: IDBObjectStore, key: IDBValidKey) =>
  promise(store.get(key) as IDBRequest<T | undefined>);

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDbOrThrow().open(DATABASE_NAME, DATABASE_VERSION);

  request.onupgradeneeded = (event) => {
    const db = request.result;

    if (event.oldVersion < 1) {
      db.createObjectStore(DOCUMENTS, { keyPath: "id" });

      const chunks = db.createObjectStore(CHUNKS, { keyPath: "id" });
      // Without it, deleting one document means reading every chunk in the
      // profile to find out which ones belonged to it.
      chunks.createIndex(CHUNKS_BY_DOCUMENT, "documentId", { unique: false });
    }

    if (event.oldVersion === 1) failTextlessDocuments(request.transaction!);
  };

  return promise(request);
}

/** A cursor, not the `getAll` helpers above: this runs inside the version-change
 * transaction, and awaiting anything outside it lets that transaction commit. */
function failTextlessDocuments(transaction: IDBTransaction) {
  const cursor = transaction.objectStore(DOCUMENTS).openCursor();

  cursor.onsuccess = () => {
    const at = cursor.result;

    if (!at) return;

    const document = at.value as LocalDocument;

    if (!document.text) {
      at.update({ ...document, status: "failed", error: RE_INGEST_REQUIRED });
    }

    at.continue();
  };
}

async function withStores<T>(
  names: string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase();

  try {
    const transaction = db.transaction(names, mode);
    const result = await work(transaction);

    // `onabort` only: a request error that nothing handles aborts the
    // transaction, so `onerror` would be a second path to the same rejection —
    // and `work()` has already rejected on that request by the time it fires.
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(failed("transaction", transaction.error));
    });

    return result;
  } finally {
    db.close();
  }
}

export async function putLocalDocument(document: LocalDocument): Promise<void> {
  await withStores([DOCUMENTS], "readwrite", async (transaction) => {
    await promise(transaction.objectStore(DOCUMENTS).put(document));
  });
}

export async function listLocalDocuments(): Promise<LocalDocument[]> {
  return withStores([DOCUMENTS], "readonly", async (transaction) => {
    const all = await getAll<LocalDocument>(transaction.objectStore(DOCUMENTS));

    return all.sort((a, b) => b.createdAt - a.createdAt);
  });
}

export async function getLocalDocument(
  id: string,
): Promise<LocalDocument | undefined> {
  return withStores([DOCUMENTS], "readonly", (transaction) =>
    getOne<LocalDocument>(transaction.objectStore(DOCUMENTS), id),
  );
}

/**
 * Rejects a vector of the wrong width rather than storing it. Cosine similarity
 * over mismatched dimensions returns a number rather than an error, so a corpus
 * embedded by two different models would rank silently and wrongly.
 */
export async function putLocalChunks(
  documentId: string,
  chunks: LocalChunk[],
): Promise<void> {
  const document = await getLocalDocument(documentId);
  if (!document) throw new LocalStoreError(`No local document ${documentId}`);

  const wrong = chunks.find(
    (chunk) =>
      chunk.embedding !== null &&
      chunk.embedding.length !== document.embeddingDimensions,
  );
  if (wrong) {
    throw new LocalStoreError(
      `Chunk ${wrong.id} has ${wrong.embedding!.length} dimensions, expected ${document.embeddingDimensions}`,
    );
  }

  await withStores([CHUNKS], "readwrite", async (transaction) => {
    const store = transaction.objectStore(CHUNKS);

    await Promise.all(
      chunks.map((chunk) => promise(store.put({ ...chunk, documentId }))),
    );
  });
}

export async function listLocalChunks(
  documentId: string,
): Promise<LocalChunk[]> {
  return withStores([CHUNKS], "readonly", async (transaction) => {
    const all = await getAll<LocalChunk>(
      transaction.objectStore(CHUNKS).index(CHUNKS_BY_DOCUMENT),
      documentId,
    );

    return all.sort((a, b) => a.index - b.index);
  });
}

/**
 * IndexedDB has no `ON DELETE CASCADE`. The server gets that from Postgres; here
 * the chunks have to be removed by hand, in the same transaction, or a deleted
 * document leaves its text behind on the machine that was promised deletion.
 */
export async function deleteLocalDocument(id: string): Promise<void> {
  await withStores([DOCUMENTS, CHUNKS], "readwrite", async (transaction) => {
    const chunks = transaction.objectStore(CHUNKS);
    const keys = await promise<IDBValidKey[]>(
      chunks.index(CHUNKS_BY_DOCUMENT).getAllKeys(id),
    );

    await Promise.all([
      promise(transaction.objectStore(DOCUMENTS).delete(id)),
      ...keys.map((key) => promise(chunks.delete(key))),
    ]);
  });
}

/**
 * Every store the database has, not a list written out here: a store added in a
 * later version would otherwise survive the control that claims to delete
 * everything, and nothing would fail.
 */
export async function deleteEverythingLocal(): Promise<void> {
  // Closed before the clear: a connection left open makes the next version bump
  // fire `blocked` and hang the upgrade for anyone who used this control.
  const db = await openDatabase();
  const names = Array.from(db.objectStoreNames);
  db.close();

  await withStores(names, "readwrite", async (transaction) => {
    await Promise.all(
      names.map((name) => promise(transaction.objectStore(name).clear())),
    );
  });
}

export type LocalStoreSummary = { documents: number; chunks: number };

export async function summarizeLocalStore(): Promise<LocalStoreSummary> {
  return withStores([DOCUMENTS, CHUNKS], "readonly", async (transaction) => {
    const [documents, chunks] = await Promise.all([
      promise(transaction.objectStore(DOCUMENTS).count()),
      promise(transaction.objectStore(CHUNKS).count()),
    ]);

    return { documents, chunks };
  });
}

/** Written back after embedding, in one transaction: a half-embedded document
 * that reported `ready` would answer from the passages that happened to finish. */
export async function setLocalEmbeddings(
  documentId: string,
  embeddings: Map<string, number[]>,
): Promise<void> {
  await withStores([DOCUMENTS, CHUNKS], "readwrite", async (transaction) => {
    const documents = transaction.objectStore(DOCUMENTS);
    // Read inside this transaction, not before it. Embedding takes tens of
    // seconds and "Delete everything" is reachable throughout: a snapshot taken
    // outside would be written back afterwards, resurrecting a deleted document
    // as `ready` with no passages at all.
    const document = await getOne<LocalDocument>(documents, documentId);
    if (!document) throw new LocalStoreError(`No local document ${documentId}`);

    const chunks = transaction.objectStore(CHUNKS);
    const stored = await getAll<LocalChunk>(
      chunks.index(CHUNKS_BY_DOCUMENT),
      documentId,
    );

    // Missing first: a chunk absent from the map also fails the width check,
    // and reporting it as the wrong size would name the wrong problem.
    const missing = stored.filter((chunk) => !embeddings.has(chunk.id));
    if (missing.length > 0) {
      // Refused rather than skipped: this call is what marks the document
      // `ready`, and a passage left without a vector is one the answer can
      // never retrieve while the document claims to be searchable.
      throw new LocalStoreError(
        `${String(missing.length)} of ${String(stored.length)} passages have no embedding`,
      );
    }

    const wrong = stored.find(
      (chunk) =>
        embeddings.get(chunk.id)!.length !== document.embeddingDimensions,
    );
    if (wrong) {
      // The same guard `putLocalChunks` carries, because this is now the only
      // path that stores a vector — and cosine similarity over a mismatched
      // width returns a number rather than an error.
      throw new LocalStoreError(
        `Chunk ${wrong.id} does not have ${String(document.embeddingDimensions)} dimensions`,
      );
    }

    await Promise.all(
      stored.map((chunk) =>
        promise(chunks.put({ ...chunk, embedding: embeddings.get(chunk.id)! })),
      ),
    );

    await promise(
      documents.put({
        ...document,
        status: "ready",
        updatedAt: Date.now(),
      } satisfies LocalDocument),
    );
  });
}

/** So a document whose embedding died is visible as failed rather than sitting
 * in `processing` forever, which nothing resumes and nothing surfaces. */
export async function markLocalDocumentFailed(
  documentId: string,
  error: string,
): Promise<void> {
  await withStores([DOCUMENTS], "readwrite", async (transaction) => {
    const documents = transaction.objectStore(DOCUMENTS);
    const document = await getOne<LocalDocument>(documents, documentId);

    // Deleted mid-embed is not a failure worth recording against nothing.
    if (!document) return;

    await promise(
      documents.put({
        ...document,
        status: "failed",
        error,
        updatedAt: Date.now(),
      } satisfies LocalDocument),
    );
  });
}
