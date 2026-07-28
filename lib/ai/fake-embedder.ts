import { createHash } from "node:crypto";

import { EMBEDDING_DIMENSIONS } from "@/lib/rag/vector";

/**
 * A deterministic stand-in for a real embedding provider.
 *
 * Ingestion is the widest code path in the project, and without this it could
 * only be exercised with a live API key — which means CI cannot run it, E2E
 * cannot run it, and nobody can develop offline. Those are the conditions under
 * which a pipeline goes untested and breaks silently.
 *
 * The vectors are meaningless as semantics but well-behaved as data: the same
 * text always produces the same vector, different text produces a different one,
 * and every vector is the right shape. That is enough to prove the pipeline
 * stores, retrieves and orders correctly. It is *not* enough to evaluate
 * retrieval quality — that needs the real provider, and Milestone 2's relevance
 * work must not be judged against these.
 *
 * Deliberately returns un-normalized vectors so that the real and fake paths
 * share one normalization step rather than each having their own.
 */

/**
 * Expands a hash into as many deterministic floats as needed. SHA-256 gives 32
 * bytes; longer vectors re-hash with a counter rather than repeating the block,
 * so components stay uncorrelated across the whole 768.
 */
// `never` as the return type, not the default `any`: the loop below is infinite,
// so the generator genuinely never returns — and declaring that makes
// `.next().value` a `number` instead of `any`.
function* pseudoRandomFloats(seed: string): Generator<number, never> {
  let counter = 0;

  for (;;) {
    const digest = createHash("sha256").update(`${seed}:${counter}`).digest();

    for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
      // Map a uint32 onto [-1, 1). Centering matters: an all-positive vector
      // would make every pair of embeddings look similar under cosine distance.
      const value = digest.readUInt32BE(offset) / 0xffffffff;
      yield value * 2 - 1;
    }

    counter += 1;
  }
}

export function fakeEmbedding(
  text: string,
  dimensions: number = EMBEDDING_DIMENSIONS,
): number[] {
  const floats = pseudoRandomFloats(text);
  const vector = new Array<number>(dimensions);

  for (let i = 0; i < dimensions; i += 1) {
    vector[i] = floats.next().value;
  }

  return vector;
}

export function fakeEmbeddings(
  texts: readonly string[],
  dimensions: number = EMBEDDING_DIMENSIONS,
): number[][] {
  return texts.map((text) => fakeEmbedding(text, dimensions));
}
