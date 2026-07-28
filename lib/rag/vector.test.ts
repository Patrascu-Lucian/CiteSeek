import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  assertEmbeddingShape,
  cosineSimilarity,
  isUnitVector,
  l2Norm,
  l2Normalize,
} from "./vector";

describe("l2Norm", () => {
  it("measures a 3-4-5 triangle", () => {
    expect(l2Norm([3, 4])).toBe(5);
  });

  it("is zero for a zero vector", () => {
    expect(l2Norm([0, 0, 0])).toBe(0);
  });

  it("is 1 for a basis vector", () => {
    expect(l2Norm([0, 1, 0])).toBe(1);
  });
});

describe("l2Normalize", () => {
  it("scales to unit length", () => {
    const unit = l2Normalize([3, 4]);
    expect(unit).toEqual([0.6, 0.8]);
    expect(isUnitVector(unit)).toBe(true);
  });

  it("preserves direction", () => {
    const unit = l2Normalize([2, 0, 0]);
    expect(unit).toEqual([1, 0, 0]);
  });

  it("handles negative components", () => {
    expect(isUnitVector(l2Normalize([-3, -4]))).toBe(true);
  });

  it("refuses a zero vector rather than producing NaNs", () => {
    // Storing NaNs would poison every similarity search afterwards, and the
    // failure would surface far from its cause.
    expect(() => l2Normalize([0, 0, 0])).toThrow(/zero-length|non-finite/i);
  });

  it("refuses a vector containing Infinity", () => {
    expect(() => l2Normalize([Infinity, 1])).toThrow(/zero-length|non-finite/i);
  });

  it("is idempotent within tolerance, but not guaranteed bit-exact", () => {
    // Normalizing twice divides by a norm that is 1 only to within floating
    // point, so the low bits of each component may shift. Whether they actually
    // do is input-dependent -- [1,2,3,4,5] happens to survive unchanged, other
    // inputs do not. That unpredictability is the hazard: an exact-equality
    // assertion downstream passes until the day someone's data makes it fail.
    //
    // The pipeline therefore normalizes at exactly one point, and this test
    // asserts only what is reliably true.
    for (const input of [
      [1, 2, 3, 4, 5],
      [0.1, 0.7, -0.3],
      [1e-4, 5, 12345.678],
    ]) {
      const once = l2Normalize(input);
      const twice = l2Normalize(once);

      expect(isUnitVector(twice)).toBe(true);
      for (let i = 0; i < once.length; i += 1) {
        expect(twice[i]).toBeCloseTo(once[i]!, 12);
      }
    }
  });
});

describe("isUnitVector", () => {
  it("accepts an exact unit vector", () => {
    expect(isUnitVector([1, 0])).toBe(true);
  });

  it("rejects a non-unit vector", () => {
    expect(isUnitVector([3, 4])).toBe(false);
  });

  it("tolerates floating-point drift within epsilon", () => {
    expect(isUnitVector([1 + 1e-12, 0])).toBe(true);
  });
});

describe("cosineSimilarity", () => {
  it("is 1 for identical direction", () => {
    expect(cosineSimilarity([1, 0], [5, 0])).toBeCloseTo(1, 10);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("is -1 for opposite direction", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("is unaffected by magnitude", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it("returns 0 rather than NaN when a vector is zero", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("refuses mismatched lengths", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      /different lengths/i,
    );
  });
});

describe("assertEmbeddingShape", () => {
  it("accepts a correctly sized vector", () => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0.1);
    expect(() => assertEmbeddingShape(vector)).not.toThrow();
  });

  it("names the misconfiguration when the size is wrong", () => {
    // The database would reject this anyway; the point is an error that says
    // "check outputDimensionality" instead of a raw SQLSTATE.
    expect(() => assertEmbeddingShape(new Array<number>(512).fill(0))).toThrow(
      /768-dimension embedding but received 512.*outputDimensionality/is,
    );
  });

  it("rejects a vector containing NaN", () => {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0.1);
    vector[42] = Number.NaN;
    expect(() => assertEmbeddingShape(vector)).toThrow(/non-finite.*index 42/i);
  });

  it("accepts a custom dimension count", () => {
    expect(() => assertEmbeddingShape([1, 2, 3], 3)).not.toThrow();
  });
});
