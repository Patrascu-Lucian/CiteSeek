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
 * **Each function takes a `workspaceId` and filters on it in SQL.** Not as a
 * convention but as the structural guarantee CLAUDE.md's quality bar #5 and ADR
 * 007 require: there is no helper here that can return another tenant's rows,
 * because there is no helper here that omits the scope.
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
  const rows = await db
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

  return rows;
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

export async function createQueuedDocument(
  workspaceId: string,
  input: { filename: string; mimeType: string; sizeBytes: number },
) {
  const [document] = await db
    .insert(documents)
    .values({ ...input, workspaceId, status: "queued" })
    .returning();

  return document!;
}

/**
 * Status transitions and extraction results.
 *
 * `updatedAt` is set explicitly on every write. Postgres will not maintain it
 * for us, and the stale-processing watchdog reads it — a document whose
 * timestamp never moves would be marked dead while it was still working.
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
    .set({ ...patch, updatedAt: new Date() })
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

  // Chunks go with it via ON DELETE CASCADE -- "real deletion" in the roadmap
  // means the embeddings are gone too, not merely unreferenced.
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
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000);

  const failed = await db
    .update(documents)
    .set({
      status: "failed",
      error:
        "Processing stopped unexpectedly and did not finish. Try uploading this document again.",
      updatedAt: new Date(),
    })
    .where(
      and(eq(documents.status, "processing"), lt(documents.updatedAt, cutoff)),
    )
    .returning({ id: documents.id });

  return failed.length;
}
