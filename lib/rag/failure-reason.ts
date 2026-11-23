import type { DocumentFailureReason, DocumentStatus } from "@/lib/db/schema";
import { StorageCeilingError } from "@/lib/limits/caps";

import { DocumentTooLargeError } from "./chunking";
import { UnreadableDocumentError } from "./extract";

/** Wrapped where the embedding phase fails, so no SDK error is ever classified
 * by its shape and an SDK update cannot reclassify one. */
export class EmbeddingFailedError extends Error {
  constructor(cause: unknown) {
    super(
      cause instanceof Error
        ? cause.message
        : typeof cause === "string"
          ? cause
          : "The embedding provider failed.",
      { cause },
    );
    this.name = "EmbeddingFailedError";
  }
}

/** By type, never by message (ADR 064). The watchdog writes `interrupted` itself. */
export function failureReasonOf(error: unknown): DocumentFailureReason {
  if (error instanceof UnreadableDocumentError) return error.kind;
  if (error instanceof DocumentTooLargeError) return "too_large";
  if (error instanceof StorageCeilingError) return "over_storage";
  if (error instanceof EmbeddingFailedError) return "embedding_unavailable";
  return "unknown";
}

/** The one rule the list and the retry route share: a retry resumes embedding,
 * so it needs the stored text and a stored passage to embed (ADR 064). */
export function canRetry(document: {
  status: DocumentStatus;
  hasText: boolean;
  chunks: number;
}): boolean {
  return (
    document.status === "failed" && document.hasText && document.chunks > 0
  );
}
