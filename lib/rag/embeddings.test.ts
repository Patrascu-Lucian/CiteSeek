import { describe, expect, it, vi } from "vitest";

import { fakeEmbeddings } from "@/lib/ai/fake-embedder";

import { type Embedder, embedPassages, embedQuery } from "./embeddings";
import { EMBEDDING_DIMENSIONS, isUnitVector } from "./vector";

/** Stands in for the provider so these tests need no key and no network. */
const workingEmbedder: Embedder = (texts) =>
  Promise.resolve(fakeEmbeddings(texts));

describe("embedPassages", () => {
  it("returns one unit vector per input", async () => {
    const vectors = await embedPassages(["alpha", "beta", "gamma"], {
      embedder: workingEmbedder,
    });

    expect(vectors).toHaveLength(3);
    for (const vector of vectors) {
      expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(isUnitVector(vector)).toBe(true);
    }
  });

  it("preserves input order", async () => {
    const [first, second] = await embedPassages(["first", "second"], {
      embedder: workingEmbedder,
    });
    const [firstAgain] = await embedPassages(["first"], {
      embedder: workingEmbedder,
    });

    expect(first).toEqual(firstAgain);
    expect(first).not.toEqual(second);
  });

  it("short-circuits an empty batch without calling the provider", async () => {
    const embedder = vi.fn<Embedder>();

    await expect(embedPassages([], { embedder })).resolves.toEqual([]);
    expect(embedder).not.toHaveBeenCalled();
  });

  it("asks for RETRIEVAL_DOCUMENT", async () => {
    const embedder = vi.fn<Embedder>((texts) =>
      Promise.resolve(fakeEmbeddings(texts)),
    );

    await embedPassages(["indexed text"], { embedder });

    expect(embedder).toHaveBeenCalledWith(
      ["indexed text"],
      "RETRIEVAL_DOCUMENT",
      undefined,
    );
  });

  it("rejects a provider that aggregates inputs into one vector", async () => {
    // The gemini-embedding-2 failure mode. Caught at the boundary, where the
    // message can name the cause, rather than as an off-by-one deep in the
    // ingestion loop.
    const aggregating: Embedder = (texts) =>
      Promise.resolve(fakeEmbeddings([texts.join(" ")]));

    await expect(
      embedPassages(["one", "two", "three"], { embedder: aggregating }),
    ).rejects.toThrow(/returned 1 vectors for 3 inputs.*aggregating model/is);
  });

  it("rejects vectors of the wrong dimension", async () => {
    const wrongSize: Embedder = (texts) =>
      Promise.resolve(fakeEmbeddings(texts, 512));

    await expect(
      embedPassages(["text"], { embedder: wrongSize }),
    ).rejects.toThrow(/768-dimension embedding but received 512/i);
  });

  it("rejects a zero vector rather than storing NaNs", async () => {
    const degenerate: Embedder = () =>
      Promise.resolve([new Array<number>(EMBEDDING_DIMENSIONS).fill(0)]);

    await expect(
      embedPassages(["text"], { embedder: degenerate }),
    ).rejects.toThrow(/zero-length|non-finite/i);
  });

  it("propagates provider failures instead of returning partial results", async () => {
    const failing: Embedder = () =>
      Promise.reject(new Error("429 rate limit exceeded"));

    await expect(
      embedPassages(["text"], { embedder: failing }),
    ).rejects.toThrow(/rate limit/i);
  });

  it("passes an abort signal through", async () => {
    const embedder = vi.fn<Embedder>((texts) =>
      Promise.resolve(fakeEmbeddings(texts)),
    );
    const signal = AbortSignal.abort();

    await embedPassages(["text"], { embedder, signal });

    expect(embedder).toHaveBeenCalledWith(
      ["text"],
      "RETRIEVAL_DOCUMENT",
      signal,
    );
  });
});

describe("embedQuery", () => {
  it("returns a single unit vector", async () => {
    const vector = await embedQuery("what is the refund policy?", {
      embedder: workingEmbedder,
    });

    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(isUnitVector(vector)).toBe(true);
  });

  it("asks for RETRIEVAL_QUERY, not RETRIEVAL_DOCUMENT", async () => {
    // gemini-embedding-001 is asymmetric: a query embedded as a document lands
    // elsewhere in the space. Getting this wrong degrades retrieval in a way
    // that looks like bad chunking rather than a config error.
    const embedder = vi.fn<Embedder>((texts) =>
      Promise.resolve(fakeEmbeddings(texts)),
    );

    await embedQuery("a question", { embedder });

    expect(embedder).toHaveBeenCalledWith(
      ["a question"],
      "RETRIEVAL_QUERY",
      undefined,
    );
  });

  it("embeds the same text differently as query and as passage", async () => {
    // Guards the asymmetry itself: if both paths ever collapse onto one task
    // type, this is what notices.
    const seen: string[] = [];
    const recording: Embedder = (texts, taskType) => {
      seen.push(taskType);
      return Promise.resolve(fakeEmbeddings(texts));
    };

    await embedQuery("same text", { embedder: recording });
    await embedPassages(["same text"], { embedder: recording });

    expect(seen).toEqual(["RETRIEVAL_QUERY", "RETRIEVAL_DOCUMENT"]);
  });
});
