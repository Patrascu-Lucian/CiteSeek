import type { Embedder } from "@/lib/rag/embeddings";

import { LOCAL_EMBEDDING_DIMENSIONS } from "./embedder";

/**
 * A browser stand-in, so tests skip a 30 MB download on a runner with no Hugging
 * Face access. **Not** `lib/ai/fake-embedder.ts`: that hashes with `node:crypto`
 * and is 768-wide for the server's column, and nothing ever compares a local
 * vector to a server one. Word overlap, not meaning — never tune a floor to it.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

/** FNV-1a, because `node:crypto` does not exist here and Web Crypto's digest is
 * async — an async hash would make the whole vectorizer async for no gain. */
function bucket(token: string, dimensions: number): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash % dimensions;
}

export function fakeLocalEmbedding(
  text: string,
  dimensions: number = LOCAL_EMBEDDING_DIMENSIONS,
): number[] {
  const vector = Array<number>(dimensions).fill(0);

  for (const token of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (token.length === 0 || STOPWORDS.has(token)) continue;

    const index = bucket(token, dimensions);
    vector[index] = vector[index]! + 1;
  }

  const length = Math.hypot(...vector);

  // A vector of nothing but stopwords has no direction. Zero is the honest
  // answer, and `cosineSimilarity` already refuses to rank it.
  return length === 0 ? vector : vector.map((value) => value / length);
}

export const fakeLocalEmbedder: Embedder = (texts) =>
  Promise.resolve({
    vectors: texts.map((text) => fakeLocalEmbedding(text)),
    tokens: 0,
  });
