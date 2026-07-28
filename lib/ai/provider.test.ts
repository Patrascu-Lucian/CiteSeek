import { describe, expect, it } from "vitest";

import {
  EMBEDDING_MODEL_ID,
  getGoogleEmbeddingModel,
  resolveEmbeddingsProvider,
} from "./provider";

describe("resolveEmbeddingsProvider", () => {
  it("defaults to google when unset", () => {
    // Defaulting to the fake would let a misconfigured production deploy fill
    // the database with meaningless vectors -- an outage that presents as poor
    // answer quality rather than as a failure.
    expect(resolveEmbeddingsProvider({})).toBe("google");
  });

  it("selects the fake provider when asked", () => {
    expect(resolveEmbeddingsProvider({ EMBEDDINGS_PROVIDER: "fake" })).toBe(
      "fake",
    );
  });

  it("selects google explicitly", () => {
    expect(resolveEmbeddingsProvider({ EMBEDDINGS_PROVIDER: "google" })).toBe(
      "google",
    );
  });

  it("ignores casing and surrounding whitespace", () => {
    expect(resolveEmbeddingsProvider({ EMBEDDINGS_PROVIDER: "  FAKE " })).toBe(
      "fake",
    );
  });

  it("treats an empty value as unset", () => {
    expect(resolveEmbeddingsProvider({ EMBEDDINGS_PROVIDER: "   " })).toBe(
      "google",
    );
  });

  it("rejects an unrecognized value instead of silently falling back", () => {
    // A typo like EMBEDDINGS_PROVIDER=faker should stop the process, not
    // quietly select the real provider and start spending quota.
    expect(() =>
      resolveEmbeddingsProvider({ EMBEDDINGS_PROVIDER: "faker" }),
    ).toThrow(/Unknown EMBEDDINGS_PROVIDER "faker".*google.*fake/is);
  });
});

describe("getGoogleEmbeddingModel", () => {
  it("explains how to proceed when no API key is set", () => {
    expect(() => getGoogleEmbeddingModel({})).toThrow(
      /GOOGLE_GENERATIVE_AI_API_KEY is not set.*EMBEDDINGS_PROVIDER=fake/is,
    );
  });

  it("builds a model when a key is present", () => {
    const model = getGoogleEmbeddingModel({
      GOOGLE_GENERATIVE_AI_API_KEY: "test-key-not-real",
    });

    expect(model).toBeDefined();
  });

  it("pins gemini-embedding-001, not an aggregating model", () => {
    // gemini-embedding-2 returns one aggregated vector for multiple inputs and
    // drops taskType, which would silently break per-chunk retrieval. ADR 002.
    expect(EMBEDDING_MODEL_ID).toBe("gemini-embedding-001");
  });
});
