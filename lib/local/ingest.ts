import type { Chunk } from "@/lib/rag/chunking";
import { UnreadableDocumentError } from "@/lib/rag/extract";
import { validateUpload } from "@/lib/documents/validation";
import { LOCAL_EMBEDDING_DIMENSIONS } from "./embedder";

import {
  putLocalChunks,
  putLocalDocument,
  LocalStoreUnavailableError,
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

type Parser = (file: File, mimeType: string) => Promise<IngestResult>;

/**
 * On the main thread, not in a worker: unpdf hangs inside one — it neither
 * resolves nor throws, so the upload waits forever. Measured at ~0.4s here for
 * both a 2-page and a 51-page PDF, which is module load rather than parsing, so
 * a worker was guarding against a stall that does not exist.
 */
async function parseFile(file: File, mimeType: string): Promise<IngestResult> {
  const { chunkText } = await import("@/lib/rag/chunking");
  const { extractText } = await import("@/lib/rag/extract");

  try {
    const extracted = await extractText(
      new Uint8Array(await file.arrayBuffer()),
      mimeType,
    );

    return {
      ok: true,
      pageCount: extracted.pageCount,
      chunks: chunkText(extracted.text, extracted.pageSpans),
    };
  } catch (cause) {
    // Only an unusable *file* gets its message shown. Anything else is a defect
    // here, and its text is for a console rather than a reader.
    return {
      ok: false,
      message:
        cause instanceof UnreadableDocumentError
          ? cause.message
          : "This document could not be read.",
    };
  }
}

/**
 * Never rejects: a store that is unavailable or out of quota has to reach the
 * reader as a message, and a rejection here leaves the upload showing "Parsing…"
 * with no way out.
 *
 * Chunks are written with `embedding: null` — the same order the server uses,
 * rows first and vectors after, which is why a parsed document is not searchable.
 */
export async function ingestLocalFile(
  file: File,
  parse: Parser = parseFile,
): Promise<{ ok: true; document: LocalDocument } | IngestFailure> {
  // The same check the upload route runs, and for the same reason: `File.type`
  // is derived from the extension, so it is a claim rather than a fact. This
  // also brings the 4 MB ceiling, which the main thread now parses under.
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const validated = validateUpload(file.name, head, file.size);

  if (!validated.ok) return { ok: false, message: validated.message };

  const parsed = await parse(file, validated.mimeType);
  if (!parsed.ok) return parsed;

  const now = Date.now();
  const id = crypto.randomUUID();

  const document: LocalDocument = {
    id,
    filename: file.name,
    mimeType: validated.mimeType,
    sizeBytes: file.size,
    status: "processing",
    error: null,
    pageCount: parsed.pageCount,
    chunkCount: parsed.chunks.length,
    embeddingDimensions: LOCAL_EMBEDDING_DIMENSIONS,
    createdAt: now,
    updatedAt: now,
  };

  try {
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
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof LocalStoreUnavailableError
          ? cause.message
          : "This browser would not store the document. It may be out of space, or storage may be blocked.",
    };
  }

  return { ok: true, document };
}
