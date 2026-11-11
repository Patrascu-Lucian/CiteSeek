import { describe, expect, it } from "vitest";

import {
  decideRefusalReason,
  unreadableEmbeddingsNotice,
} from "./refusal-reason";

describe("decideRefusalReason", () => {
  it("says nothing is indexed when no chunk is embedded", () => {
    expect(decideRefusalReason([], "fake")).toBe("no_documents");
    expect(decideRefusalReason([{ model: "fake", chunks: 0 }], "fake")).toBe(
      "no_documents",
    );
  });

  it("says nothing matched when the configured model has chunks", () => {
    expect(decideRefusalReason([{ model: "fake", chunks: 3 }], "fake")).toBe(
      "no_relevant_passages",
    );
  });

  it("names a mismatch when every chunk came from another model", () => {
    // The 1.9.1 failure: Gemini's vectors stored, the fake configured.
    expect(
      decideRefusalReason(
        [{ model: "gemini-embedding-001", chunks: 24 }],
        "fake",
      ),
    ).toBe("embedding_model_mismatch");
  });

  it("names a mismatch when the only vectors were never labeled", () => {
    expect(decideRefusalReason([{ model: null, chunks: 5 }], "fake")).toBe(
      "embedding_model_mismatch",
    );
  });

  it("needs one searchable chunk, not a majority, to call it a miss", () => {
    expect(
      decideRefusalReason(
        [
          { model: "gemini-embedding-001", chunks: 24 },
          { model: "fake", chunks: 1 },
        ],
        "fake",
      ),
    ).toBe("no_relevant_passages");
  });

  it("reads the configured model, whichever it is", () => {
    expect(
      decideRefusalReason(
        [{ model: "gemini-embedding-001", chunks: 2 }],
        "gemini-embedding-001",
      ),
    ).toBe("no_relevant_passages");
  });
});

describe("unreadableEmbeddingsNotice", () => {
  it("says nothing when every vector is the configured model's", () => {
    expect(
      unreadableEmbeddingsNotice([{ model: "fake", chunks: 3 }], "fake"),
    ).toBeNull();
    expect(unreadableEmbeddingsNotice([], "fake")).toBeNull();
  });

  it("ignores a model with no chunks", () => {
    expect(
      unreadableEmbeddingsNotice(
        [
          { model: "fake", chunks: 3 },
          { model: "gemini-embedding-001", chunks: 0 },
        ],
        "fake",
      ),
    ).toBeNull();
  });

  it("is an error naming models and counts when nothing is searchable", () => {
    expect(
      unreadableEmbeddingsNotice(
        [{ model: "gemini-embedding-001", chunks: 24 }],
        "fake",
      ),
    ).toEqual({
      level: "error",
      line: "Unreadable embeddings: configured fake 0, other gemini-embedding-001 24.",
    });
  });

  it("is a warning when part is searchable, listing every other model", () => {
    expect(
      unreadableEmbeddingsNotice(
        [
          { model: "fake", chunks: 3 },
          { model: "gemini-embedding-001", chunks: 2 },
          { model: null, chunks: 1 },
        ],
        "fake",
      ),
    ).toEqual({
      level: "warn",
      line: "Unreadable embeddings: configured fake 3, other gemini-embedding-001 2, unlabeled 1.",
    });
  });
});
