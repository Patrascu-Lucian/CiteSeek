import type { Chunk } from "@/lib/rag/chunking";
import { isSupportedMimeType } from "@/lib/rag/extract";

import {
  putLocalChunks,
  putLocalDocument,
  type LocalChunk,
  type LocalDocument,
} from "./store";

export type IngestSuccess = {
  ok: true;
  pageCount: number | null;
  chunks: Chunk[];
};

export type IngestFailure = { ok: false; message: string };

export type IngestResult = IngestSuccess | IngestFailure;

/** The width the local embedder will produce. Carried per document so a change
 * of model does not silently mix two vector spaces in one store. */
export const LOCAL_EMBEDDING_DIMENSIONS = 384;

type Parser = (file: File) => Promise<IngestResult>;

/**
 * On the main thread, not in a worker: unpdf hangs inside one — it neither
 * resolves nor throws, so the upload waits forever. Measured at ~0.4s here for
 * both a 2-page and a 51-page PDF, which is module load rather than parsing, so
 * a worker was guarding against a stall that does not exist.
 */
async function parseFile(file: File): Promise<IngestResult> {
  const { chunkText } = await import("@/lib/rag/chunking");
  const { extractText } = await import("@/lib/rag/extract");

  try {
    const extracted = await extractText(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );

    return {
      ok: true,
      pageCount: extracted.pageCount,
      chunks: chunkText(extracted.text, extracted.pageSpans),
    };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

/**
 * Chunks are written with `embedding: null` — the same order the server uses,
 * rows first and vectors after, which is why a parsed document is not searchable.
 */
export async function ingestLocalFile(
  file: File,
  parse: Parser = parseFile,
): Promise<{ ok: true; document: LocalDocument } | IngestFailure> {
  if (!isSupportedMimeType(file.type)) {
    return {
      ok: false,
      message: `Unsupported file type: ${file.type || "unknown"}. Upload a PDF, Word document, Markdown or text file.`,
    };
  }

  const parsed = await parse(file);
  if (!parsed.ok) return parsed;

  const now = Date.now();
  const id = crypto.randomUUID();

  const document: LocalDocument = {
    id,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    status: "processing",
    error: null,
    pageCount: parsed.pageCount,
    chunkCount: parsed.chunks.length,
    embeddingDimensions: LOCAL_EMBEDDING_DIMENSIONS,
    createdAt: now,
    updatedAt: now,
  };

  await putLocalDocument(document);
  await putLocalChunks(
    id,
    parsed.chunks.map((chunk): LocalChunk => ({
      id: `${id}:${chunk.chunkIndex}`,
      documentId: id,
      index: chunk.chunkIndex,
      text: chunk.content,
      page: chunk.pageNumber,
      startOffset: chunk.charStart,
      endOffset: chunk.charEnd,
      embedding: null,
    })),
  );

  return { ok: true, document };
}
