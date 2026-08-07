import { and, asc, cosineDistance, eq, isNotNull, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { chunks, documents } from "@/lib/db/schema";

import { resolveEmbeddingsProvider } from "@/lib/ai/provider";

import { type Embedder, embedQuery } from "./embeddings";
import { RETRIEVAL_LIMIT, maxDistanceFor } from "./retrieval-config";

/** Scoped in SQL like every helper in `lib/documents/queries.ts`, and on `chunks`
 * rather than the joined document — ADR 026. */

// Re-exported so callers keep one import for retrieval, while the constants stay
// reachable without pulling in a database connection.
export { RETRIEVAL_LIMIT, maxDistanceFor };

export type RetrievedChunk = {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  charStart: number;
  charEnd: number;
  pageNumber: number | null;
  /** Cosine distance from the query. Lower is closer. */
  distance: number;
};

export type RetrieveOptions = {
  limit?: number;
  maxDistance?: number;
  /** Injectable for tests, mirroring `embedPassages` / `embedQuery`. */
  embedder?: Embedder;
  signal?: AbortSignal;
};

/** Tokens alongside results: the query is embedded *before* the floor applies, so
 * the refusal branch was paid for too — and that is the traffic abuse
 * generates. */
export type RetrievalResult = {
  chunks: RetrievedChunk[];
  tokens: number;
};

export async function retrieveChunks(
  workspaceId: string,
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrievalResult> {
  const {
    limit = RETRIEVAL_LIMIT,
    // Resolved from the configured provider rather than a single constant: the
    // floor is a property of the embedding model, and the two in use here put
    // "relevant" in very different numeric ranges.
    maxDistance = maxDistanceFor(resolveEmbeddingsProvider()),
    embedder,
    signal,
  } = options;

  // An empty query embeds to a meaningless vector and would return the workspace's
  // arbitrary top-k rather than nothing. Answer it as "no matches" instead.
  if (query.trim().length === 0) return { chunks: [], tokens: 0 };

  const { vector, tokens } = await embedQuery(query, { embedder, signal });
  const distance = cosineDistance(chunks.embedding, vector);

  const found = await db.transaction(async (tx) => {
    // Without this the index returns `ef_search` global neighbors and the filter
    // discards the foreign ones afterward, so a small tenant retrieves nothing
    // (ADR 026). `relaxed_order` is safe because the outer query re-sorts.
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = relaxed_order`);

    // Two-step on purpose. The inner query is the shape HNSW accelerates: order by
    // the distance operator, take top k. `WHERE distance <= x` inside it would
    // force a distance for every candidate row — an approximate index cannot answer
    // a threshold predicate, it only walks its graph outward from the query point.
    // So the floor is applied outside, over at most `limit` rows already found.
    const candidates = tx
      .select({
        id: chunks.id,
        documentId: chunks.documentId,
        filename: documents.filename,
        content: chunks.content,
        charStart: chunks.charStart,
        charEnd: chunks.charEnd,
        pageNumber: chunks.pageNumber,
        distance: sql<number>`${distance}`.as("distance"),
      })
      .from(chunks)
      // Joined for the filename, not for scope.
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(
        and(
          eq(chunks.workspaceId, workspaceId),
          // Ingestion inserts chunks before embedding them, so a document still
          // processing has rows with a null embedding. `<=>` against null yields
          // null, which would sort ahead of every real distance under `ASC`.
          isNotNull(chunks.embedding),
        ),
      )
      .orderBy(asc(distance))
      .limit(limit)
      .as("candidates");

    return (
      tx
        .select()
        .from(candidates)
        .where(lte(candidates.distance, maxDistance))
        // The inner ordering is what selects the top k, but a subquery's order is not
        // guaranteed to survive into the outer result. Restated so callers can rely on
        // it: marker [1] must be the closest passage.
        .orderBy(asc(candidates.distance))
    );
  });

  // `tokens` is reported whether or not anything cleared the floor. An empty
  // result is not a free one.
  return { chunks: found, tokens };
}
