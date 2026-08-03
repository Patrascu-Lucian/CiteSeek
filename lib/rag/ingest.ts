import {
  countChunks,
  insertChunks,
  listUnembeddedChunks,
  setChunkEmbeddings,
  updateDocument,
} from "@/lib/documents/queries";

import { MAX_CHUNKS_PER_DOCUMENT, chunkText } from "./chunking";
import { type Embedder, embedPassages, getEmbedder } from "./embeddings";
import { UnreadableDocumentError, extractText } from "./extract";

/**
 * Extraction → chunking → embedding → storage, inside `after()` and so in the
 * upload's own serverless invocation. Two consequences: **it can be killed at any
 * moment**, so progress is persisted per batch and a watchdog fails abandoned
 * documents; and **nothing is watching**, so every failure must reach the
 * document row or it is lost.
 *
 * `documents.error` holds a truncated message, never document text — an error
 * column is a log by another name.
 */

/** How many chunks are embedded per provider call. */
const EMBED_BATCH_SIZE = 32;

/** Long enough to be useful in the UI, short enough not to become a data leak. */
const MAX_ERROR_LENGTH = 500;

export type IngestOptions = {
  /** Injectable so tests run without a provider. Defaults to the configured one. */
  embedder?: Embedder;
  signal?: AbortSignal;
};

/** No `cause` chains or stack traces: a parser error can quote the bytes it choked
 * on, and those bytes are the user's document. */
export function sanitizeError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred.";

  const collapsed = raw.replace(/\s+/g, " ").trim();

  return collapsed.length > MAX_ERROR_LENGTH
    ? `${collapsed.slice(0, MAX_ERROR_LENGTH - 1)}…`
    : collapsed;
}

async function markFailed(
  workspaceId: string,
  documentId: string,
  error: unknown,
): Promise<void> {
  await updateDocument(workspaceId, documentId, {
    status: "failed",
    error: sanitizeError(error),
  });
}

/** Each batch is persisted before the next is requested, so a rate limit halfway
 * through a 600-chunk document keeps the work already done. */
async function embedPendingChunks(
  workspaceId: string,
  documentId: string,
  options: IngestOptions,
): Promise<{ embedded: number; tokens: number }> {
  const embedder = options.embedder ?? getEmbedder();
  let embedded = 0;
  let tokens = 0;

  for (;;) {
    const pending = await listUnembeddedChunks(
      workspaceId,
      documentId,
      EMBED_BATCH_SIZE,
    );
    if (pending.length === 0) break;

    const batch = await embedPassages(
      pending.map((chunk) => chunk.content),
      { embedder, signal: options.signal },
    );

    // Accumulated per batch, before the write. A run that fails halfway has
    // still spent everything it embedded, and that quota does not become free
    // because the document never reached `ready`.
    tokens += batch.tokens;

    const written = await setChunkEmbeddings(
      workspaceId,
      documentId,
      pending.map((chunk, index) => ({
        id: chunk.id,
        embedding: batch.vectors[index]!,
      })),
    );

    if (written === 0) {
      // The document was deleted, or moved out of reach, while we were working.
      // Stopping beats looping forever over rows we cannot write.
      break;
    }

    embedded += written;

    // Keep the row's timestamp moving so the stale-processing watchdog can tell
    // slow progress from an abandoned job.
    await updateDocument(workspaceId, documentId, { status: "processing" });
  }

  return { embedded, tokens };
}

/** `bytes` live only for this call: nothing hits disk, and the extracted text
 * replaces them as the stored representation. */
export async function processDocument(
  workspaceId: string,
  documentId: string,
  bytes: Uint8Array,
  mimeType: string,
  options: IngestOptions = {},
): Promise<{ embeddingTokens: number }> {
  // Accumulated outside the try so a failure still reports what it spent before
  // failing. Quota consumed by a document that never reached `ready` is spent
  // all the same.
  let embeddingTokens = 0;

  try {
    await updateDocument(workspaceId, documentId, {
      status: "processing",
      error: null,
    });

    const extracted = await extractText(bytes, mimeType);
    const chunks = chunkText(extracted.text, extracted.pageSpans);

    if (chunks.length === 0) {
      throw new UnreadableDocumentError(
        "No readable text was found in this document.",
      );
    }

    // Store the canonical text *before* the chunks that index into it, so a
    // failure can never leave chunks whose offsets point at a missing string.
    await updateDocument(workspaceId, documentId, {
      contentText: extracted.text,
      pageSpans: extracted.pageSpans,
      pageCount: extracted.pageCount,
      chunkCount: chunks.length,
    });

    await insertChunks(
      workspaceId,
      documentId,
      chunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        pageNumber: chunk.pageNumber,
      })),
    );

    embeddingTokens += (
      await embedPendingChunks(workspaceId, documentId, options)
    ).tokens;

    const remaining = await listUnembeddedChunks(workspaceId, documentId, 1);
    if (remaining.length > 0) {
      throw new Error(
        "Some passages could not be embedded. Retry to finish processing this document.",
      );
    }

    await updateDocument(workspaceId, documentId, {
      status: "ready",
      error: null,
    });
  } catch (error) {
    await markFailed(workspaceId, documentId, error);
  }

  return { embeddingTokens };
}

/** The throws either side of this are caught locally on purpose: the message *is*
 * the payload, sanitized into `documents.error` and read by the user. Early
 * returns would need a second channel for the same string. */

/**
 * Retry without re-extracting. Only meaningful when extraction succeeded and just
 * the embeddings are incomplete — a parse failure has no chunks to resume, and
 * re-running a parser that already rejected the file would fail identically.
 */
export async function resumeEmbedding(
  workspaceId: string,
  documentId: string,
  options: IngestOptions = {},
): Promise<{ resumed: boolean; embeddingTokens: number }> {
  const total = await countChunks(workspaceId, documentId);
  if (total === 0) return { resumed: false, embeddingTokens: 0 };

  // Outside the try for the same reason as `processDocument`: a run that fails
  // partway has still spent what it embedded.
  let embeddingTokens = 0;

  try {
    await updateDocument(workspaceId, documentId, {
      status: "processing",
      error: null,
    });

    embeddingTokens += (
      await embedPendingChunks(workspaceId, documentId, options)
    ).tokens;

    const remaining = await listUnembeddedChunks(workspaceId, documentId, 1);
    if (remaining.length > 0) {
      throw new Error(
        "Some passages still could not be embedded. This is usually a temporary rate limit — try again shortly.",
      );
    }

    await updateDocument(workspaceId, documentId, {
      status: "ready",
      error: null,
    });

    return { resumed: true, embeddingTokens };
  } catch (error) {
    await markFailed(workspaceId, documentId, error);
    return { resumed: true, embeddingTokens };
  }
}

export { MAX_CHUNKS_PER_DOCUMENT };
