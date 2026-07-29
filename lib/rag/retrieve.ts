import { and, asc, cosineDistance, eq, isNotNull, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { chunks, documents } from "@/lib/db/schema";

import { type Embedder, embedQuery } from "./embeddings";

/**
 * Vector search over a workspace's passages.
 *
 * Like every helper in `lib/documents/queries.ts`, this takes a `workspaceId` and
 * filters on it **in SQL**. Chunks carry no workspace of their own — they inherit
 * it through their document — so the scope is applied on the joined `documents`
 * row rather than trusting anything the caller passed about the chunk itself.
 */

/**
 * The relevance floor, in cosine distance (0 = identical direction, 2 = opposite).
 *
 * Below this a passage is treated as an answer; above it, as noise. When nothing
 * clears the floor the model is never called, which is what makes "I don't know"
 * structural rather than a request in a prompt.
 *
 * **Provisional.** Cosine distance is only meaningful relative to the embedding
 * model that produced it, so this needs tuning against `gemini-embedding-001` on
 * real documents. It cannot be tuned against the fake embedder — those vectors
 * are deterministic hashes with no semantic geometry, so distances between them
 * mean nothing about relevance.
 */
export const MAX_DISTANCE = 0.6;

/** Passages per answer. Enough context to answer from, few enough to stay grounded. */
export const RETRIEVAL_LIMIT = 8;

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

export async function retrieveChunks(
  workspaceId: string,
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const {
    limit = RETRIEVAL_LIMIT,
    maxDistance = MAX_DISTANCE,
    embedder,
    signal,
  } = options;

  // An empty query embeds to a meaningless vector and would return the workspace's
  // arbitrary top-k rather than nothing. Answer it as "no matches" instead.
  if (query.trim().length === 0) return [];

  const embedding = await embedQuery(query, { embedder, signal });
  const distance = cosineDistance(chunks.embedding, embedding);

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

  return (
    db
      .select()
      .from(candidates)
      .where(lte(candidates.distance, maxDistance))
      // The inner ordering is what selects the top k, but a subquery's order is not
      // guaranteed to survive into the outer result. Restated so callers can rely on
      // it: marker [1] must be the closest passage.
      .orderBy(asc(candidates.distance))
  );
}
