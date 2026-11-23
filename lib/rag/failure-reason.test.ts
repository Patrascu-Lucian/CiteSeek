import { describe, expect, it } from "vitest";

import { StorageCeilingError, storageExceededMessage } from "@/lib/limits/caps";

import { DocumentTooLargeError } from "./chunking";
import { UnreadableDocumentError } from "./extract";
import {
  EmbeddingFailedError,
  canRetry,
  failureReasonOf,
} from "./failure-reason";

describe("failureReasonOf", () => {
  it("reads an unreadable file's kind, so a scan keeps its own reason", () => {
    expect(
      failureReasonOf(
        new UnreadableDocumentError("a scan", { kind: "no_text" }),
      ),
    ).toBe("no_text");
    expect(
      failureReasonOf(
        new UnreadableDocumentError("damaged", { kind: "unreadable" }),
      ),
    ).toBe("unreadable");
  });

  it("names each ceiling and the embedding phase by its type", () => {
    expect(failureReasonOf(new DocumentTooLargeError(900))).toBe("too_large");
    expect(failureReasonOf(new StorageCeilingError(500_000))).toBe(
      "over_storage",
    );
    expect(failureReasonOf(new EmbeddingFailedError(new Error("429")))).toBe(
      "embedding_unavailable",
    );
  });

  it("calls anything else unknown, whatever its message says", () => {
    expect(failureReasonOf(new Error("This file is empty."))).toBe("unknown");
    expect(failureReasonOf("a thrown string")).toBe("unknown");
    expect(failureReasonOf(undefined)).toBe("unknown");
  });
});

describe("EmbeddingFailedError", () => {
  it("keeps its cause and the cause's message, for the operator", () => {
    const cause = new Error("Quota exceeded for the embedding model.");
    const error = new EmbeddingFailedError(cause);

    expect(error.message).toBe(cause.message);
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("EmbeddingFailedError");
  });

  it("takes a message when there is no error to wrap", () => {
    expect(
      new EmbeddingFailedError("Some passages could not be embedded.").message,
    ).toBe("Some passages could not be embedded.");
  });

  it("still says what failed when the cause is neither", () => {
    expect(new EmbeddingFailedError({ status: 503 }).message).toBe(
      "The embedding provider failed.",
    );
  });
});

describe("StorageCeilingError", () => {
  it("carries the sentence the storage cap already writes", () => {
    expect(new StorageCeilingError(500_000).message).toBe(
      storageExceededMessage(500_000),
    );
  });
});

describe("canRetry", () => {
  const failed = { status: "failed", hasText: true, chunks: 3 } as const;

  it("offers a retry to a failed document with text and passages", () => {
    expect(canRetry(failed)).toBe(true);
  });

  it("refuses without text, which every reason that cannot retry lacks", () => {
    expect(canRetry({ ...failed, hasText: false })).toBe(false);
  });

  it("refuses text with no passage, where a retry would do nothing", () => {
    expect(canRetry({ ...failed, chunks: 0 })).toBe(false);
  });

  it("refuses a document that has not failed", () => {
    for (const status of ["queued", "processing", "ready"] as const) {
      expect(canRetry({ ...failed, status })).toBe(false);
    }
  });
});
