import type { ChatSource, RefusalReason } from "@/lib/ai/types";
import { maxDistanceFor, RETRIEVAL_LIMIT } from "@/lib/rag/retrieval-config";
import { cosineSimilarity } from "@/lib/rag/vector";

import { resolveLocalEmbedder, resolveLocalProvider } from "./embedder";
import { listLocalDocuments, listLocalChunks } from "./store";

export type LocalRetrieval =
  | { sources: ChatSource[]; refusal: null }
  | { sources: []; refusal: RefusalReason };

/**
 * The local half of the guarantee in ADR 011: nothing generates unless a passage
 * clears the floor, so a refusal has nothing to cite and a citation always has a
 * passage behind it. The server does this in SQL; here it is a scan, which is
 * affordable because a browser corpus is bounded by what one person uploaded.
 */
export async function retrieveLocally(
  question: string,
): Promise<LocalRetrieval> {
  const documents = await listLocalDocuments();
  const searchable = documents.filter((one) => one.status === "ready");

  // Distinguished before searching, because "you have not added anything" and
  // "nothing here matches" send a reader to different next steps.
  if (searchable.length === 0) {
    return { sources: [], refusal: "no_documents" };
  }

  const embed = await resolveLocalEmbedder();
  const { vectors } = await embed([question], "RETRIEVAL_QUERY");
  const query = vectors[0]!;

  const scored = (
    await Promise.all(
      searchable.map(async (document) => {
        const chunks = await listLocalChunks(document.id);

        return chunks
          .filter((chunk) => chunk.embedding !== null)
          .map((chunk) => ({
            chunk,
            document,
            distance: 1 - cosineSimilarity(query, chunk.embedding!),
          }));
      }),
    )
  ).flat();

  const floor = maxDistanceFor(resolveLocalProvider());
  const kept = scored
    .filter((one) => one.distance <= floor)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, RETRIEVAL_LIMIT);

  if (kept.length === 0) {
    return { sources: [], refusal: "no_relevant_passages" };
  }

  return {
    refusal: null,
    sources: kept.map(({ chunk, document }, index) => ({
      // 1-based, matching the `[n]` a model writes.
      marker: index + 1,
      chunkId: chunk.id,
      documentId: document.id,
      filename: document.filename,
      pageNumber: chunk.page,
      charStart: chunk.startOffset,
      charEnd: chunk.endOffset,
      quote: chunk.text,
    })),
  };
}
