const DATABASE_NAME = "citeseek-local";
const DATABASE_VERSION = 1;

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

export class LocalStoreUnavailableError extends Error {
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
  new Error(`The IndexedDB ${what} failed.`, { cause });

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

  // No `contains` guards: at version 1 this fires only for a database that does
  // not exist yet. Version 2 needs `oldVersion` branching instead, and that is
  // migration logic to write then, not to guess at now.
  request.onupgradeneeded = () => {
    const db = request.result;

    db.createObjectStore(DOCUMENTS, { keyPath: "id" });

    const chunks = db.createObjectStore(CHUNKS, { keyPath: "id" });
    // Without it, deleting one document means reading every chunk in the
    // profile to find out which ones belonged to it.
    chunks.createIndex(CHUNKS_BY_DOCUMENT, "documentId", { unique: false });
  };

  return promise(request);
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
  if (!document) throw new Error(`No local document ${documentId}`);

  const wrong = chunks.find(
    (chunk) =>
      chunk.embedding !== null &&
      chunk.embedding.length !== document.embeddingDimensions,
  );
  if (wrong) {
    throw new Error(
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
  const document = await getLocalDocument(documentId);
  if (!document) throw new Error(`No local document ${documentId}`);

  await withStores([DOCUMENTS, CHUNKS], "readwrite", async (transaction) => {
    const chunks = transaction.objectStore(CHUNKS);
    const stored = await getAll<LocalChunk>(
      chunks.index(CHUNKS_BY_DOCUMENT),
      documentId,
    );

    const missing = stored.filter((chunk) => !embeddings.has(chunk.id));
    if (missing.length > 0) {
      // Refused rather than skipped: this call is what marks the document
      // `ready`, and a passage left without a vector is one the answer can
      // never retrieve while the document claims to be searchable.
      throw new Error(
        `${String(missing.length)} of ${String(stored.length)} passages have no embedding`,
      );
    }

    await Promise.all(
      stored.map((chunk) =>
        promise(chunks.put({ ...chunk, embedding: embeddings.get(chunk.id)! })),
      ),
    );

    await promise(
      transaction.objectStore(DOCUMENTS).put({
        ...document,
        status: "ready",
        updatedAt: Date.now(),
      } satisfies LocalDocument),
    );
  });
}
