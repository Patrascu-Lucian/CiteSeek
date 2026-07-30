import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
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
 * **Each function takes a `workspaceId` and filters on it in SQL.** Tenant
 * isolation is structural rather than conventional: there is no helper here that
 * can return another tenant's rows, because there is no helper here that omits
 * the scope. See ADR 007 for why this is treated as a one-way door.
 *
 * Chunks have no `workspace_id` of their own — they inherit it through their
 * document — so chunk queries join to `documents` and filter there rather than
 * trusting a document id that a caller supplied.
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
  // A LEFT JOIN with a grouped count rather than a correlated subquery.
  //
  // The subquery form is the obvious way to write this and it silently does not
  // work: inside a `sql` template Drizzle emits column references *unqualified*,
  // so `WHERE ${chunks.documentId} = ${documents.id}` renders as
  // `WHERE "document_id" = "id"` — and within `FROM "chunks"` both names resolve
  // to chunks' own columns. It compares a chunk's foreign key to its own primary
  // key, matches nothing, and returns 0 forever. In a join Drizzle qualifies
  // every reference, because it has to.
  //
  // `count(chunks.embedding)` counts non-null values, which is exactly the
  // progress figure wanted, and LEFT JOIN keeps documents that have no chunks.
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
 * Returns an explicit column list rather than a bare `.returning()`.
 *
 * A bare `.returning()` asks Postgres for every column the *schema* declares,
 * including ones the caller never reads. That made this insert fail against any
 * database whose schema had drifted — which is exactly what happened in
 * production: migration 0001 added `content_text` and `page_spans`, the
 * migration had not been applied there, and uploads returned a 500 with no body
 * while the documents list kept working because it selects columns explicitly.
 *
 * Asking only for what is used means schema drift breaks the queries that
 * actually depend on the missing column, and nothing else.
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
 * Status transitions and extraction results.
 *
 * `updatedAt` is set explicitly on every write, using the database's clock via
 * `now()` rather than a JavaScript `Date`.
 *
 * That distinction is load-bearing. `createdAt`/`updatedAt` default to
 * `defaultNow()`, which is Postgres' clock, and the database is on another
 * machine. Passing `new Date()` from the app mixes two clocks in one column, and
 * with even a few milliseconds of skew an update can write a timestamp *earlier*
 * than the insert it follows — observed at 23 ms against Neon. The
 * stale-processing watchdog compares these timestamps, so a column that can move
 * backwards is a correctness problem rather than a cosmetic one.
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
 * `after()` runs inside the request's serverless invocation, so a function
 * timeout kills ingestion mid-flight with no chance to record the failure. The
 * document would otherwise sit in `processing` forever, showing a spinner that
 * never resolves and offering no retry. Called from the list endpoint, so the
 * act of looking at a stuck document is what unsticks it.
 *
 * Deliberately global rather than workspace-scoped: it is a maintenance sweep
 * over abandoned rows, reads nothing back, and returning per-workspace results
 * would make it a data-access path.
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
