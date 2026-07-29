import { describe, expect, it } from "vitest";

import {
  CHAT_MODEL_ID,
  EMBEDDING_MODEL_ID,
  getChatModel,
  getGoogleEmbeddingModel,
  resolveChatProvider,
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

describe("resolveChatProvider", () => {
  it("defaults to google when unset", () => {
    // Same reasoning as embeddings: a deploy that quietly served canned answers
    // would look like a bad model rather than a misconfiguration.
    expect(resolveChatProvider({})).toBe("google");
  });

  it("selects the fake provider when asked", () => {
    expect(resolveChatProvider({ CHAT_PROVIDER: "fake" })).toBe("fake");
  });

  it("selects google explicitly", () => {
    expect(resolveChatProvider({ CHAT_PROVIDER: "google" })).toBe("google");
  });

  it("ignores casing and surrounding whitespace", () => {
    expect(resolveChatProvider({ CHAT_PROVIDER: "  FAKE " })).toBe("fake");
  });

  it("treats an empty value as unset", () => {
    expect(resolveChatProvider({ CHAT_PROVIDER: "   " })).toBe("google");
  });

  it("rejects an unrecognized value instead of silently falling back", () => {
    expect(() => resolveChatProvider({ CHAT_PROVIDER: "openai" })).toThrow(
      /Unknown CHAT_PROVIDER/,
    );
  });

  it("is independent of the embeddings knob", () => {
    // Two switches, not one: embedding and generation fail differently and are
    // plausibly served by different vendors.
    expect(resolveChatProvider({ EMBEDDINGS_PROVIDER: "fake" })).toBe("google");
  });
});

describe("getChatModel", () => {
  it("explains how to proceed when no API key is set", () => {
    expect(() => getChatModel({})).toThrow(/CHAT_PROVIDER=fake/);
  });

  it("returns the fake model without needing a key", () => {
    expect(getChatModel({ CHAT_PROVIDER: "fake" })).toBeDefined();
  });

  it("pins an explicit model version rather than a floating alias", () => {
    // A `-latest` alias would change generation behaviour without a decision,
    // and the grounding rules in prompt.ts are tuned against this model.
    expect(CHAT_MODEL_ID).toBe("gemini-3.5-flash-lite");
    expect(CHAT_MODEL_ID).not.toMatch(/latest/);
  });

  it("builds a Google model when a key is present", () => {
    const model = getChatModel({ GOOGLE_GENERATIVE_AI_API_KEY: "test-key" });

    expect(model).toBeDefined();
  });
});
