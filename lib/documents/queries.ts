import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  type DocumentPageSpan,
  type DocumentStatus,
  chunks,
  documents,
} from "@/lib/db/schema";

/**
 * Every read and write of document data.
 *
 * **Each function takes a `workspaceId` and filters on it in SQL** — there is no
 * helper here that omits the scope, which is what makes tenant isolation
 * structural rather than conventional (ADR 007). Chunks inherit their scope
 * through their document, so chunk queries join to `documents` rather than
 * trusting a caller-supplied id.
 */

/** Documents stuck in `processing` longer than this are presumed dead. */
export const STALE_PROCESSING_MINUTES = 10;

export type DocumentSummary = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  pageCount: number | null;
  chunkCount: number | null;
  embeddedChunkCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The documents list. `embeddedChunkCount` drives the progress shown while a
 * document is processing, which is why it is computed here rather than by a
 * second round trip per row.
 */
export async function listDocuments(
  workspaceId: string,
): Promise<DocumentSummary[]> {
  // LEFT JOIN with a grouped count, not a correlated subquery: inside a `sql`
  // template Drizzle emits column references *unqualified*, so the subquery form
  // compares a chunk's foreign key to its own primary key and returns 0 forever.
  // A join forces qualification. `count(chunks.embedding)` counts non-nulls,
  // which is the progress figure wanted.
  return db
    .select({
      id: documents.id,
      filename: documents.filename,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      status: documents.status,
      error: documents.error,
      pageCount: documents.pageCount,
      chunkCount: documents.chunkCount,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      embeddedChunkCount: sql<number>`count(${chunks.embedding})::int`,
    })
    .from(documents)
    .leftJoin(chunks, eq(chunks.documentId, documents.id))
    .where(eq(documents.workspaceId, workspaceId))
    .groupBy(documents.id)
    .orderBy(desc(documents.createdAt));
}

export async function findDocumentInWorkspace(
  workspaceId: string,
  documentId: string,
) {
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId)),
    )
    .limit(1);

  return document ?? null;
}

/**
 * Explicit column list, not a bare `.returning()`, which asks for every column
 * the *schema* declares. That made this insert fail in production against a
 * database missing migration 0001, while the documents list kept working because
 * it selects explicitly. Asking only for what is used confines drift to the
 * queries that actually need the missing column.
 */
export async function createQueuedDocument(
  workspaceId: string,
  input: { filename: string; mimeType: string; sizeBytes: number },
) {
  const [document] = await db
    .insert(documents)
    .values({ ...input, workspaceId, status: "queued" })
    .returning({
      id: documents.id,
      workspaceId: documents.workspaceId,
      filename: documents.filename,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      status: documents.status,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    });

  return document!;
}

/**
 * `updatedAt` uses the database clock via `now()`, never a JavaScript `Date`.
 * The columns default to Postgres' clock, so passing one from the app mixes two
 * clocks in one column — observed at 23 ms of skew against Neon, enough for an
 * update to timestamp *earlier* than the insert it follows. The stale-processing
 * watchdog compares these, so backwards movement is a correctness bug.
 */
export async function updateDocument(
  workspaceId: string,
  documentId: string,
  patch: {
    status?: DocumentStatus;
    error?: string | null;
    contentText?: string | null;
    pageSpans?: DocumentPageSpan[] | null;
    pageCount?: number | null;
    chunkCount?: number | null;
  },
) {
  const [updated] = await db
    .update(documents)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(
      and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId)),
    )
    .returning();

  return updated ?? null;
}

export async function deleteDocumentInWorkspace(
  workspaceId: string,
  documentId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId)),
    )
    .returning({ id: documents.id });

  // Chunks go with it via ON DELETE CASCADE. Deletion has to be real: the
  // embeddings are gone too, not merely unreferenced.
  return deleted.length > 0;
}

export type NewChunkInput = {
  chunkIndex: number;
  content: string;
  charStart: number;
  charEnd: number;
  pageNumber: number | null;
};

/**
 * Insert chunks for a document, verifying the document belongs to the workspace
 * first. Without that check a caller could attach chunks to someone else's
 * document by guessing an id.
 */
export async function insertChunks(
  workspaceId: string,
  documentId: string,
  rows: readonly NewChunkInput[],
) {
  if (rows.length === 0) return [];

  const document = await findDocumentInWorkspace(workspaceId, documentId);
  if (!document) return [];

  return db
    .insert(chunks)
    .values(rows.map((row) => ({ ...row, documentId })))
    .returning({ id: chunks.id, chunkIndex: chunks.chunkIndex });
}

/**
 * Chunks still awaiting an embedding, oldest first.
 *
 * This is what makes retry resume rather than restart: after a rate-limited
 * failure the chunks already embedded are skipped, so a retry costs only the
 * remainder of the quota rather than all of it again.
 */
export async function listUnembeddedChunks(
  workspaceId: string,
  documentId: string,
  limit = 100,
) {
  return db
    .select({
      id: chunks.id,
      content: chunks.content,
      chunkIndex: chunks.chunkIndex,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(
        eq(chunks.documentId, documentId),
        eq(documents.workspaceId, workspaceId),
        isNull(chunks.embedding),
      ),
    )
    .orderBy(asc(chunks.chunkIndex))
    .limit(limit);
}

/** Attach embeddings to chunks, scoped through the owning document. */
export async function setChunkEmbeddings(
  workspaceId: string,
  documentId: string,
  updates: readonly { id: string; embedding: number[] }[],
): Promise<number> {
  if (updates.length === 0) return 0;

  const document = await findDocumentInWorkspace(workspaceId, documentId);
  if (!document) return 0;

  const ids = updates.map((u) => u.id);
  const owned = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(and(eq(chunks.documentId, documentId), inArray(chunks.id, ids)));

  const ownedIds = new Set(owned.map((row) => row.id));
  let written = 0;

  for (const update of updates) {
    if (!ownedIds.has(update.id)) continue;
    await db
      .update(chunks)
      .set({ embedding: update.embedding })
      .where(eq(chunks.id, update.id));
    written += 1;
  }

  return written;
}

/**
 * How many passages are actually searchable — a chunk with no embedding cannot be
 * retrieved, so "has documents" and "has something to search" differ while one is
 * still processing.
 *
 * Called only when retrieval comes back empty, to tell "nothing indexed" apart
 * from "nothing matched". Guessing between them means telling someone to upload a
 * document they already uploaded.
 */
export async function countSearchableChunks(workspaceId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(eq(documents.workspaceId, workspaceId), isNotNull(chunks.embedding)),
    );

  return row?.total ?? 0;
}

export async function countChunks(workspaceId: string, documentId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(
        eq(chunks.documentId, documentId),
        eq(documents.workspaceId, workspaceId),
      ),
    );

  return row?.total ?? 0;
}

/**
 * Marks abandoned work as failed.
 *
 * `after()` runs inside the serverless invocation, so a timeout kills ingestion
 * with no chance to record it and the document sits in `processing` forever.
 * Called from the list endpoint, so looking at a stuck document is what unsticks
 * it. Global rather than workspace-scoped: a maintenance sweep that reads nothing
 * back is not a data-access path.
 */
export async function failStaleProcessing(): Promise<number> {
  // The cutoff is computed by Postgres too. Deriving it from `Date.now()` would
  // compare the app's clock against timestamps written by the database's, and
  // the skew between them is exactly what this comparison must not depend on.
  const failed = await db
    .update(documents)
    .set({
      status: "failed",
      error:
        "Processing stopped unexpectedly and did not finish. Try uploading this document again.",
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(documents.status, "processing"),
        lt(
          documents.updatedAt,
          sql`now() - make_interval(mins => ${STALE_PROCESSING_MINUTES})`,
        ),
      ),
    )
    .returning({ id: documents.id });

  return failed.length;
}
