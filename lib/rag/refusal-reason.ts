import type { EmbeddingModelId, RefusalReason } from "@/lib/db/schema";

/** Embedded chunks per model in one workspace, as `countEmbeddedChunksByModel`
 * returns them; `null` is a vector stored before its model was recorded. */
export type EmbeddedChunkCounts = readonly {
  model: EmbeddingModelId | null;
  chunks: number;
}[];

function searchableBy(
  counts: EmbeddedChunkCounts,
  configured: EmbeddingModelId,
): number {
  return counts.find((row) => row.model === configured)?.chunks ?? 0;
}

/** Why nothing was retrieved, as a pure function over counts — no database. */
export function decideRefusalReason(
  counts: EmbeddedChunkCounts,
  configured: EmbeddingModelId,
): RefusalReason {
  if (counts.every((row) => row.chunks === 0)) return "no_documents";
  return searchableBy(counts, configured) === 0
    ? "embedding_model_mismatch"
    : "no_relevant_passages";
}

export type OperatorNotice = { level: "error" | "warn"; line: string };

/**
 * One line for the operator when a workspace holds vectors retrieval cannot
 * read: an error when nothing is searchable, a warning when only part is. Models
 * and counts, never content, and no workspace: the request path the platform
 * logs beside it already names one. Null when every vector is the configured
 * model's.
 */
export function unreadableEmbeddingsNotice(
  counts: EmbeddedChunkCounts,
  configured: EmbeddingModelId,
): OperatorNotice | null {
  const others = counts.filter(
    (row) => row.model !== configured && row.chunks > 0,
  );
  if (others.length === 0) return null;

  const searchable = searchableBy(counts, configured);
  const stored = others
    .map((row) => `${row.model ?? "unlabeled"} ${String(row.chunks)}`)
    .join(", ");

  return {
    level: searchable === 0 ? "error" : "warn",
    line: `Unreadable embeddings: configured ${configured} ${String(searchable)}, other ${stored}.`,
  };
}
