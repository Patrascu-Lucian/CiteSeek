import { afterEach, describe, expect, it, vi } from "vitest";

import type * as ProviderModule from "@/lib/ai/provider";

import { EMBEDDING_DIMENSIONS } from "./vector";

const embedMany = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({ embedMany }));
vi.mock("@/lib/ai/provider", async (importOriginal) => ({
  ...(await importOriginal<typeof ProviderModule>()),
  getGoogleEmbeddingModel: () => "stub-model",
}));

const { embedPassages, embedQuery, getEmbedder } = await import("./embeddings");

/**
 * Covers the provider wiring that the main suite deliberately bypasses by
 * injecting an embedder. The request options asserted here -- dimensionality and
 * task type -- are the settings most likely to be silently wrong, because a
 * mistake produces vectors that store and retrieve without error and simply
 * rank badly.
 */

function unitVectors(count: number): number[][] {
  return Array.from({ length: count }, () => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    vector[0] = 1;
    return vector;
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  embedMany.mockReset();
});

describe("getEmbedder", () => {
  it("returns the fake embedder when EMBEDDINGS_PROVIDER=fake", async () => {
    vi.stubEnv("EMBEDDINGS_PROVIDER", "fake");

    const vectors = await getEmbedder()(["text"], "RETRIEVAL_DOCUMENT");

    expect(vectors).toHaveLength(1);
    expect(embedMany).not.toHaveBeenCalled();
  });

  it("returns the google embedder by default", async () => {
    vi.stubEnv("EMBEDDINGS_PROVIDER", "");
    embedMany.mockResolvedValue({ embeddings: unitVectors(1) });

    await getEmbedder()(["text"], "RETRIEVAL_DOCUMENT");

    expect(embedMany).toHaveBeenCalledOnce();
  });
});

describe("google provider options", () => {
  it("requests 768 dimensions and RETRIEVAL_DOCUMENT for passages", async () => {
    vi.stubEnv("EMBEDDINGS_PROVIDER", "google");
    embedMany.mockResolvedValue({ embeddings: unitVectors(2) });

    await embedPassages(["a", "b"]);

    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["a", "b"],
        providerOptions: {
          google: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
            taskType: "RETRIEVAL_DOCUMENT",
          },
        },
      }),
    );
  });

  it("requests RETRIEVAL_QUERY for queries", async () => {
    vi.stubEnv("EMBEDDINGS_PROVIDER", "google");
    embedMany.mockResolvedValue({ embeddings: unitVectors(1) });

    await embedQuery("a question");

    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          google: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
            taskType: "RETRIEVAL_QUERY",
          },
        },
      }),
    );
  });

  it("bounds parallelism and enables retries", async () => {
    // Free-tier requests-per-minute is the binding constraint on a 600-chunk
    // document. Unbounded parallelism is the quickest route to a rate-limited
    // ingest that fails halfway.
    vi.stubEnv("EMBEDDINGS_PROVIDER", "google");
    embedMany.mockResolvedValue({ embeddings: unitVectors(1) });

    await embedPassages(["a"]);

    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({ maxParallelCalls: 2, maxRetries: 5 }),
    );
  });

  it("forwards an abort signal", async () => {
    vi.stubEnv("EMBEDDINGS_PROVIDER", "google");
    embedMany.mockResolvedValue({ embeddings: unitVectors(1) });
    const signal = AbortSignal.abort();

    await embedPassages(["a"], { signal });

    expect(embedMany).toHaveBeenCalledWith(
      expect.objectContaining({ abortSignal: signal }),
    );
  });
});
