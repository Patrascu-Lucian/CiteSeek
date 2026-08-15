import { describe, expect, it } from "vitest";

import { fakeLocalEmbedding, fakeLocalEmbedder } from "./fake-embedder";

describe("the browser's fake embedder", () => {
  it("puts text sharing words closer than text that shares none", async () => {
    // The one property a hash of the whole string cannot give: without it a
    // question would be orthogonal to the passage answering it, and the
    // ingestion tests would pass while retrieval could never work.
    const { vectors } = await fakeLocalEmbedder(
      [
        "reimbursement is paid within thirty days",
        "reimbursement paid quickly",
        "the harbour equipment manual",
      ],
      "RETRIEVAL_DOCUMENT",
    );

    const dot = (a: number[], b: number[]) =>
      a.reduce((sum, value, index) => sum + value * b[index]!, 0);

    expect(dot(vectors[0]!, vectors[1]!)).toBeGreaterThan(
      dot(vectors[0]!, vectors[2]!),
    );
  });

  it("returns a zero vector for text that is only stopwords", () => {
    // No direction to normalize. Dividing by zero would produce NaN, which
    // ranks unpredictably rather than not at all.
    expect(fakeLocalEmbedding("what is the of and to")).toEqual(
      Array<number>(384).fill(0),
    );
  });

  it("produces the width the store expects", () => {
    expect(fakeLocalEmbedding("anything at all")).toHaveLength(384);
  });

  it("is deterministic, so a rerun does not reshuffle the ranking", () => {
    expect(fakeLocalEmbedding("reimbursement")).toEqual(
      fakeLocalEmbedding("reimbursement"),
    );
  });

  it("bills nobody", async () => {
    const { tokens } = await fakeLocalEmbedder(["x"], "RETRIEVAL_DOCUMENT");

    expect(tokens).toBe(0);
  });
});
