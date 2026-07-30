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
 * Extraction → chunking → embedding → storage.
 *
 * Runs inside `after()`, so it executes after the upload response has been sent
 * but still within the same serverless invocation. Two consequences shape the
 * design:
 *
 * 1. **It can be killed at any moment.** A function timeout ends the pipeline
 *    with no chance to record why, which is why progress is persisted per batch
 *    rather than at the end, and why a separate watchdog marks abandoned
 *    documents failed.
 * 2. **Nothing is watching it.** There is no caller to return an error to, so
 *    every failure has to be written to the document row or it is lost entirely.
 *
 * Errors stored in `documents.error` are sanitized: a truncated exception
 * message and never document text. An error column is a log by another name,
 * and document contents do not belong in logs.
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

/**
 * Turn an unknown thrown value into something safe to store.
 *
 * Deliberately does not include `cause` chains or stack traces: a parser error
 * can quote the bytes it choked on, and those bytes are the user's document.
 */
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

/**
 * Embed whatever chunks still lack a vector, in batches.
 *
 * Each batch is persisted before the next is requested. If the provider rate
 * limits us halfway through a 600-chunk document, the work already done
 * survives — and `listUnembeddedChunks` means a retry picks up exactly where it
 * stopped rather than paying for all of it again.
 */
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

/**
 * Full ingestion for a freshly uploaded document.
 *
 * `bytes` are held only for the duration of this call — nothing is written to
 * disk, and the extracted text replaces them as the stored representation.
 */
export async function processDocument(
  workspaceId: string,
  documentId: string,
  bytes: Uint8Array,
  mimeType: string,
  options: IngestOptions = {},
): Promise<void> {
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

    await embedPendingChunks(workspaceId, documentId, options);

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
}

/**
 * Retry a failed document without re-extracting it.
 *
 * Only meaningful when extraction already succeeded — the text and chunks are
 * still there, and just the embeddings are incomplete. A document that failed
 * during parsing has no chunks to resume, so the caller is told to delete and
 * re-upload instead: re-running a parser that already rejected the file would
 * fail identically.
 */
export async function resumeEmbedding(
  workspaceId: string,
  documentId: string,
  options: IngestOptions = {},
): Promise<{ resumed: boolean }> {
  const total = await countChunks(workspaceId, documentId);
  if (total === 0) return { resumed: false };

  try {
    await updateDocument(workspaceId, documentId, {
      status: "processing",
      error: null,
    });

    await embedPendingChunks(workspaceId, documentId, options);

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

    return { resumed: true };
  } catch (error) {
    await markFailed(workspaceId, documentId, error);
    return { resumed: true };
  }
}

export { MAX_CHUNKS_PER_DOCUMENT };
