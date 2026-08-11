import type { Chunk } from "@/lib/rag/chunking";
import { DocumentTooLargeError } from "@/lib/rag/chunking";
import { UnreadableDocumentError } from "@/lib/rag/extract";
import { validateUpload } from "@/lib/documents/validation";
import { LOCAL_EMBEDDING_DIMENSIONS, resolveLocalEmbedder } from "./embedder";

import {
  putLocalChunks,
  putLocalDocument,
  markLocalDocumentFailed,
  setLocalEmbeddings,
  LocalStoreError,
  LocalStoreUnavailableError,
  listLocalChunks,
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
    // Both of these explain themselves to a reader; anything else is a defect
    // here, and its text belongs in a console. The too-large one comes from the
    // chunker rather than the parser, which is why it needs naming separately.
    return {
      ok: false,
      message:
        cause instanceof UnreadableDocumentError ||
        cause instanceof DocumentTooLargeError
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
    return { ok: false, message: describe(cause) };
  }

  return { ok: true, document };
}

/** Same size as the server batches at, and for the same reason: one call per
 * passage is a round trip per passage even when the model is local. */
const EMBED_BATCH_SIZE = 32;

/**
 * Separate from `ingestLocalFile` because it is the slow half — tens of seconds
 * on a first run, while the weights download. The caller shows progress against
 * it, which it cannot do if both halves are one await.
 */
export async function embedLocalDocument(
  documentId: string,
  onProgress?: (embedded: number, total: number) => void,
  resolveEmbedder = resolveLocalEmbedder,
): Promise<{ ok: true } | IngestFailure> {
  try {
    const chunks = await listLocalChunks(documentId);
    const embed = await resolveEmbedder();
    const embeddings = new Map<string, number[]>();

    for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBED_BATCH_SIZE);
      const { vectors } = await embed(
        batch.map((chunk) => chunk.text),
        "RETRIEVAL_DOCUMENT",
      );

      batch.forEach((chunk, index) => {
        embeddings.set(chunk.id, vectors[index]!);
      });

      onProgress?.(
        Math.min(start + batch.length, chunks.length),
        chunks.length,
      );
    }

    await setLocalEmbeddings(documentId, embeddings);

    return { ok: true };
  } catch (cause) {
    // Marked `failed`, not left in `processing`: nothing resumes an abandoned
    // ingest, so a document stuck mid-flight is invisible in the counts and
    // unreachable except by deleting everything.
    await markLocalDocumentFailed(documentId, describe(cause)).catch(() => {
      // The store is the thing that failed. Reporting beats masking it.
    });

    return { ok: false, message: describe(cause) };
  }
}

/** Storage and model failures read differently to a reader, and telling someone
 * out of disk space to check their connection sends them the wrong way. Typed,
 * not matched on message text, so a reworded error cannot change the advice. */
function describe(cause: unknown): string {
  if (cause instanceof LocalStoreUnavailableError) return cause.message;

  return cause instanceof LocalStoreError
    ? "This browser would not store the document. It may be out of space, or storage may be blocked."
    : "The model could not be loaded. Check your connection and try again.";
}
