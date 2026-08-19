import {
  and,
  asc,
  count,
  desc,
  eq,
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
  workspaces,
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

/** `embeddedChunkCount` drives the processing progress bar — computed here rather
 * than a round trip per row. */
export async function listDocuments(
  workspaceId: string,
): Promise<DocumentSummary[]> {
  // LEFT JOIN, not a correlated subquery: inside a `sql` template Drizzle emits
  // column references unqualified, so the subquery compares a chunk's foreign key
  // to its own primary key and returns 0 forever. `count(embedding)` skips nulls.
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

/** Every row, whatever its status. A `ready`-only count is bypassable —
 * `createQueuedDocument` inserts before extraction, so concurrent uploads would
 * all pass at zero. `failed` rides along so the refusal can name what to delete. */
export async function countDocuments(
  workspaceId: string,
): Promise<{ total: number; failed: number }> {
  const [row] = await db
    .select({
      total: count(),
      failed: sql<number>`count(*) filter (where ${documents.status} = 'failed')::int`,
    })
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId));

  return { total: row?.total ?? 0, failed: row?.failed ?? 0 };
}

/** Extracted text, which is what ADR 009 says the product keeps. Not chunk
 * count — halving the chunk target in Milestone 2 would have halved every
 * reader's allowance with it. */
export async function sumExtractedCharacters(
  workspaceId: string,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(length(${documents.contentText})), 0)::int`,
    })
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId));

  return row?.total ?? 0;
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

/** What the caps count, read under the lock rather than before it. */
export type WorkspaceHoldings = {
  documents: number;
  failedDocuments: number;
  characters: number;
};

/**
 * The insert, admitted against a count nothing can change underneath it: two
 * uploads at 2 of 3 otherwise both read 2 and both write, which is exactly what
 * the dropzone's multi-file selection does. `for update` on the workspace row
 * serializes one workspace and leaves the rest alone.
 *
 * `refuse` returns the reason rather than a boolean, keeping policy in the route
 * beside the copy that explains it.
 */
export async function createQueuedDocumentUnless<Refusal>(
  workspaceId: string,
  input: { filename: string; mimeType: string; sizeBytes: number },
  refuse: (holdings: WorkspaceHoldings) => Refusal | null,
): Promise<
  | {
      admitted: true;
      document: Awaited<ReturnType<typeof createQueuedDocument>>;
    }
  | { admitted: false; refusal: Refusal; holdings: WorkspaceHoldings }
> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select 1 from ${workspaces} where ${workspaces.id} = ${workspaceId} for update`,
    );

    const [row] = await tx
      .select({
        documents: count(),
        failedDocuments: sql<number>`count(*) filter (where ${documents.status} = 'failed')::int`,
        characters: sql<number>`coalesce(sum(length(${documents.contentText})), 0)::int`,
      })
      .from(documents)
      .where(eq(documents.workspaceId, workspaceId));

    const holdings: WorkspaceHoldings = {
      documents: row?.documents ?? 0,
      failedDocuments: row?.failedDocuments ?? 0,
      characters: row?.characters ?? 0,
    };

    const refusal = refuse(holdings);
    if (refusal !== null) return { admitted: false, refusal, holdings };

    const [document] = await tx
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

    return { admitted: true, document: document! };
  });
}

/** Explicit columns in both `.returning()`s above and below, not a bare one,
 * which asks for every column the *schema* declares — that failed in production
 * against a database missing migration 0001, while the list kept working because
 * it selects explicitly. */
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

/** `updatedAt` uses `now()`, never a JS `Date`: the column defaults to Postgres'
 * clock, and mixing two machines' clocks let an update predate its own insert —
 * 23 ms of skew observed against Neon. The stale-processing watchdog compares
 * these, so backwards movement is a correctness bug. */
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

/** Verifies the document belongs to the workspace first, or a guessed id attaches
 * chunks to someone else's document. */
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
    .values(rows.map((row) => ({ ...row, documentId, workspaceId })))
    .returning({ id: chunks.id, chunkIndex: chunks.chunkIndex });
}

/** What makes retry resume rather than restart: already-embedded chunks are
 * skipped, so a retry costs only the remainder of the quota. */
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

export async function setChunkEmbeddings(
  workspaceId: string,
  documentId: string,
  updates: readonly { id: string; embedding: number[] }[],
): Promise<number> {
  if (updates.length === 0) return 0;

  const document = await findDocumentInWorkspace(workspaceId, documentId);
  if (!document) return 0;

  // One statement, not one per chunk: the cost was a round trip each, so 600 for
  // a document at the ceiling. 32 chunks 1062 ms → 71 ms — measured from a laptop
  // 31.6 ms from Neon, where a colocated function pays ~1-2 ms.
  const rows = updates.map(
    (update) =>
      sql`(${update.id}::uuid, ${JSON.stringify(update.embedding)}::vector)`,
  );

  // A foreign id joins on `v.id` and then fails `document_id`, so it is dropped
  // by the join rather than by a set built from a preceding SELECT. `workspace_id`
  // is deliberately not the predicate here: it is denormalized (ADR 026) and can
  // drift, so the workspace check above stays on `documents`.
  const written = await db.execute(sql`
    UPDATE ${chunks}
    SET ${sql.identifier("embedding")} = v.embedding
    FROM (VALUES ${sql.join(rows, sql`, `)}) AS v(id, embedding)
    WHERE ${chunks.id} = v.id AND ${chunks.documentId} = ${documentId}
    RETURNING ${chunks.id}
  `);

  return written.length;
}

/** A chunk with no embedding cannot be retrieved, so "has documents" and "has
 * something to search" differ while one is processing. Called only on the empty
 * branch, to tell "nothing indexed" from "nothing matched". */
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

/** `after()` runs inside the invocation, so a timeout leaves a document in
 * `processing` forever. Called from the list endpoint — looking at a stuck
 * document unsticks it. Global rather than scoped: it reads nothing back. */
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
