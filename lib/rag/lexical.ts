import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { chunks, documents } from "@/lib/db/schema";

import { RETRIEVAL_LIMIT } from "./retrieval-config";

/** Unused by the answer path — ADR 021 measured it and it lost. **Terms are
 * ORed**: the built-in parsers AND them, so "which oil goes in it?" becomes
 * `oil & goe` and matches nothing. */

/** Alphanumeric only, which is what makes the `|` join safe to interpolate. */
function terms(query: string): string[] {
  return query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export type LexicalChunk = {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  charStart: number;
  charEnd: number;
  pageNumber: number | null;
  /** `ts_rank_cd`, where **higher is better** — the opposite of the cosine
   * distances everywhere else in retrieval. */
  rank: number;
};

export async function retrieveLexical(
  workspaceId: string,
  query: string,
  options: { limit?: number } = {},
): Promise<LexicalChunk[]> {
  const { limit = RETRIEVAL_LIMIT } = options;

  const words = terms(query);
  if (words.length === 0) return [];

  // Must match `chunks_content_fts_idx` exactly, or the planner ignores it and
  // this becomes a sequential scan that computes a tsvector per row.
  const document = sql`to_tsvector('english', ${chunks.content})`;
  const search = sql`to_tsquery('english', ${words.join(" | ")})`;
  const rank = sql<number>`ts_rank_cd(${document}, ${search})`;

  // Tied ranks in scan order moved MRR@8 from 0.53 to 0.52 on an unrelated plan
  // change. Ordered by filename, not id: ids are `defaultRandom()`, so they are
  // new on every ingest and the eval harness re-ingests on every run.
  return db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      filename: documents.filename,
      content: chunks.content,
      charStart: chunks.charStart,
      charEnd: chunks.charEnd,
      pageNumber: chunks.pageNumber,
      rank: rank.as("rank"),
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(
        // Not required here — a GIN index filters exactly — but kept identical to
        // `retrieve.ts`, where it is load-bearing.
        eq(chunks.workspaceId, workspaceId),
        sql`${document} @@ ${search}`,
      ),
    )
    .orderBy(desc(rank), asc(documents.filename), asc(chunks.chunkIndex))
    .limit(limit);
}
