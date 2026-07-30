import { and, asc, cosineDistance, eq, isNotNull, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { chunks, documents } from "@/lib/db/schema";

import { resolveEmbeddingsProvider } from "@/lib/ai/provider";

import { type Embedder, embedQuery } from "./embeddings";
import { RETRIEVAL_LIMIT, maxDistanceFor } from "./retrieval-config";

/**
 * Vector search over a workspace's passages.
 *
 * Like every helper in `lib/documents/queries.ts`, this takes a `workspaceId` and
 * filters on it **in SQL**. Chunks carry no workspace of their own — they inherit
 * it through their document — so the scope is applied on the joined `documents`
 * row rather than trusting anything the caller passed about the chunk itself.
 */

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

/**
 * What a retrieval cost, alongside what it found.
 *
 * The query is embedded *before* the relevance floor is applied, so a question
 * that matches nothing has still been paid for. Returning the token count means
 * a caller metering usage can charge for the refusal branch too — which is
 * exactly the traffic anyone abusing the endpoint would generate.
 */
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

  // Two-step on purpose. The inner query is the shape pgvector's HNSW index can
  // actually accelerate: order by the distance operator, take the top k. Adding
  // `WHERE distance <= x` to *that* query would force the planner to compute a
  // distance for every candidate row instead, because an approximate index cannot
  // answer a threshold predicate — it only knows how to walk its graph outward
  // from the query point.
  //
  // So the floor is applied outside, over at most `limit` rows that have already
  // been found. Same result, and the index still does the work.
  const candidates = db
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
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        // Ingestion inserts chunks before embedding them, so a document still
        // processing has rows with a null embedding. `<=>` against null yields
        // null, which would sort ahead of every real distance under `ASC`.
        isNotNull(chunks.embedding),
      ),
    )
    .orderBy(asc(distance))
    .limit(limit)
    .as("candidates");

  const found = await db
    .select()
    .from(candidates)
    .where(lte(candidates.distance, maxDistance))
    // The inner ordering is what selects the top k, but a subquery's order is not
    // guaranteed to survive into the outer result. Restated so callers can rely on
    // it: marker [1] must be the closest passage.
    .orderBy(asc(candidates.distance));

  // `tokens` is reported whether or not anything cleared the floor. An empty
  // result is not a free one.
  return { chunks: found, tokens };
}
