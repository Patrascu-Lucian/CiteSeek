import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  cosineSimilarity,
  isUnitVector,
  l2Normalize,
} from "@/lib/rag/vector";

import { fakeEmbedding, fakeEmbeddings } from "./fake-embedder";

describe("fakeEmbedding", () => {
  it("returns the configured dimension count", () => {
    expect(fakeEmbedding("hello")).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("is deterministic — the same text always gives the same vector", () => {
    // The property the whole test strategy rests on. Without it, an ingestion
    // test could pass on one run and fail on the next for no reason.
    expect(fakeEmbedding("the retrieval index is rebuilt nightly")).toEqual(
      fakeEmbedding("the retrieval index is rebuilt nightly"),
    );
  });

  it("gives different vectors for different text", () => {
    expect(fakeEmbedding("alpha")).not.toEqual(fakeEmbedding("beta"));
  });

  it("is sensitive to small differences", () => {
    expect(fakeEmbedding("page 1")).not.toEqual(fakeEmbedding("page 2"));
  });

  it("produces only finite values", () => {
    expect(fakeEmbedding("finite check").every(Number.isFinite)).toBe(true);
  });

  it("centers components around zero rather than all-positive", () => {
    // An all-positive vector would make every pair look similar under cosine
    // distance, which would mask ordering bugs in retrieval tests.
    const vector = fakeEmbedding("distribution check");
    expect(vector.some((v) => v > 0)).toBe(true);
    expect(vector.some((v) => v < 0)).toBe(true);
    expect(Math.min(...vector)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...vector)).toBeLessThan(1);
  });

  it("does not correlate across the hash-block boundary", () => {
    // SHA-256 yields 32 bytes = 8 floats, so a 768-dim vector needs 96 blocks.
    // Repeating one block would make components 0..7 identical to 8..15 and
    // every fake vector degenerate.
    const vector = fakeEmbedding("block boundary");
    expect(vector.slice(0, 8)).not.toEqual(vector.slice(8, 16));
  });

  it("is usable as an embedding once normalized", () => {
    // Returned un-normalized on purpose, so real and fake share one
    // normalization step.
    const raw = fakeEmbedding("normalization path");
    expect(isUnitVector(raw)).toBe(false);
    expect(isUnitVector(l2Normalize(raw))).toBe(true);
  });

  it("gives near-orthogonal vectors for unrelated text", () => {
    // Not a semantic claim — just confirms distinct inputs are distinguishable
    // rather than clustering, so ordering assertions in retrieval tests mean
    // something.
    const similarity = cosineSimilarity(
      l2Normalize(fakeEmbedding("quarterly financial report")),
      l2Normalize(fakeEmbedding("recipe for sourdough bread")),
    );
    expect(Math.abs(similarity)).toBeLessThan(0.2);
  });

  it("honors a custom dimension count", () => {
    expect(fakeEmbedding("small", 16)).toHaveLength(16);
  });
});

describe("fakeEmbeddings", () => {
  it("embeds each input independently", () => {
    const [first, second] = fakeEmbeddings(["one", "two"]);

    expect(first).toEqual(fakeEmbedding("one"));
    expect(second).toEqual(fakeEmbedding("two"));
  });

  it("returns one vector per input, not an aggregate", () => {
    // Guards against the gemini-embedding-2 failure mode, where multiple inputs
    // collapse into a single vector. The fake must not hide that shape.
    expect(fakeEmbeddings(["a", "b", "c"])).toHaveLength(3);
  });

  it("handles an empty batch", () => {
    expect(fakeEmbeddings([])).toEqual([]);
  });
});
