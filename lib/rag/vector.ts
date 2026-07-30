/**
 * Vector helpers. Pure, no I/O, no provider knowledge.
 *
 * Embeddings are stored L2-normalized (unit length) so that cosine distance and
 * inner product agree, and so pgvector's `vector_cosine_ops` index behaves
 * predictably. Normalization happens exactly once, at the boundary where vectors
 * arrive from a provider -- see the note on `l2Normalize` for why that matters.
 */

export const EMBEDDING_DIMENSIONS = 768;

/** Euclidean length. */
export function l2Norm(vector: readonly number[]): number {
  let sumOfSquares = 0;
  for (const value of vector) {
    sumOfSquares += value * value;
  }
  return Math.sqrt(sumOfSquares);
}

/**
 * Scale a vector to unit length.
 *
 * **Call this once per vector.** It is mathematically idempotent but not
 * bit-exact: re-normalizing an already-unit vector divides by a norm of
 * 0.9999999999999999 rather than exactly 1, which perturbs the low bits of every
 * component. Nothing breaks numerically, but exact-equality assertions start
 * failing for reasons that look like a logic bug and are not. The pipeline
 * therefore normalizes at one place only -- when a provider returns raw vectors.
 */
export function l2Normalize(vector: readonly number[]): number[] {
  const norm = l2Norm(vector);

  if (norm === 0 || !Number.isFinite(norm)) {
    // A zero vector has no direction, so there is no meaningful unit form. This
    // indicates a provider returned garbage; failing loudly beats storing NaNs
    // that would silently poison every similarity search afterward.
    throw new Error(
      "Cannot normalize a zero-length or non-finite vector — the embedding provider returned unusable output.",
    );
  }

  return vector.map((value) => value / norm);
}

/** Whether a vector is already unit length, within floating-point tolerance. */
export function isUnitVector(
  vector: readonly number[],
  epsilon = 1e-9,
): boolean {
  return Math.abs(l2Norm(vector) - 1) <= epsilon;
}

/**
 * Cosine similarity in [-1, 1]. For unit vectors this is just the dot product,
 * but the general form is kept so callers cannot silently depend on inputs
 * happening to be normalized.
 */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length) {
    throw new Error(
      `Cannot compare vectors of different lengths: ${a.length} and ${b.length}.`,
    );
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i += 1) {
    dotProduct += a[i]! * b[i]!;
  }

  const denominator = l2Norm(a) * l2Norm(b);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Guard at the storage boundary. The `chunks.embedding` column is `vector(768)`
 * and Postgres rejects anything else, but failing here gives a message that
 * names the provider misconfiguration rather than surfacing a SQLSTATE 22000.
 */
export function assertEmbeddingShape(
  vector: readonly number[],
  dimensions: number = EMBEDDING_DIMENSIONS,
): void {
  if (vector.length !== dimensions) {
    throw new Error(
      `Expected a ${dimensions}-dimension embedding but received ${vector.length}. Check outputDimensionality on the embedding provider.`,
    );
  }

  for (let i = 0; i < vector.length; i += 1) {
    if (!Number.isFinite(vector[i]!)) {
      throw new Error(
        `Embedding contains a non-finite value at index ${i}; refusing to store it.`,
      );
    }
  }
}
