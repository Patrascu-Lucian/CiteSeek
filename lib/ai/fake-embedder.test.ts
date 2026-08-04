import { describe, expect, it } from "vitest";

import { MAX_DISTANCE_BY_PROVIDER } from "@/lib/rag/retrieval-config";
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

  it("stays sparse, so all-positive components do not make everything similar", () => {
    // Counts are never negative, which would normally make every pair look
    // alike under cosine distance and mask ordering bugs. Sparsity is what
    // prevents it: two texts with no shared vocabulary occupy different
    // dimensions entirely and stay orthogonal.
    const vector = fakeEmbedding("quarterly financial report");

    expect(vector.every((v) => v >= 0)).toBe(true);
    expect(vector.filter((v) => v > 0).length).toBeLessThan(10);
  });

  it("counts a repeated word more heavily than a single mention", () => {
    const once = fakeEmbedding("reimbursement");
    const twice = fakeEmbedding("reimbursement reimbursement");

    expect(Math.max(...twice)).toBe(2 * Math.max(...once));
  });

  it("never returns a vector with no direction", () => {
    // An all-zero vector cannot be normalized. Text that is empty, punctuation
    // only, or entirely stopwords still has to produce something usable.
    for (const text of ["", "   ", "!!!", "the and of"]) {
      expect(isUnitVector(l2Normalize(fakeEmbedding(text)))).toBe(true);
    }
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

  it("puts text that shares words closer than text that does not", () => {
    // The property the end-to-end test depends on. A hash of the whole string
    // makes a question orthogonal to the passage answering it, so the only
    // query that could retrieve anything is one identical to a stored passage —
    // and no real question is.
    const passage = l2Normalize(
      fakeEmbedding(
        "Reimbursement is paid within 30 days of an approved claim.",
      ),
    );
    const related = l2Normalize(fakeEmbedding("When is reimbursement paid?"));
    const unrelated = l2Normalize(
      fakeEmbedding("Which laptop sizes are offered?"),
    );

    expect(cosineSimilarity(passage, related)).toBeGreaterThan(
      cosineSimilarity(passage, unrelated),
    );
  });

  it("keeps an unrelated question beyond the relevance floor", () => {
    // Why stopwords are dropped: "what is the capital of France?" shares four
    // words with almost any English passage, enough to drag it under the floor.
    //
    // A distance rather than an exact zero, since hashing onto 768 dimensions
    // makes collisions inevitable; and a realistic passage, since cosine
    // distance depends on length.
    const passage = l2Normalize(
      fakeEmbedding(
        `Employees may claim reimbursement for equipment, software licenses and
         co-working space. Claims must be submitted within 60 days of purchase,
         and reimbursement is paid within 30 days of an approved claim. Claims
         over 500 require written approval from a line manager before the
         purchase is made, not after. Receipts are required for every claim
         regardless of value. A bank statement is not a receipt.`,
      ),
    );
    const unrelated = l2Normalize(
      fakeEmbedding("What is the capital of France?"),
    );

    const distance = 1 - cosineSimilarity(passage, unrelated);
    expect(distance).toBeGreaterThan(MAX_DISTANCE_BY_PROVIDER.fake);
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
