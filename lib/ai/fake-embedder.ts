import { createHash } from "node:crypto";

import { EMBEDDING_DIMENSIONS } from "@/lib/rag/vector";

/**
 * A deterministic stand-in, so retrieval runs without an API key. A hashing
 * bag-of-words vectorizer: text sharing words lands close, where hashing the
 * whole string would leave a question orthogonal to its own answer. **Not
 * semantic** — literal overlap only, so the relevance floor must never be tuned
 * against these numbers. Un-normalized, so real and fake share one step.
 */

/** Removed so two unrelated sentences do not look similar merely for both being
 * English: "what is the capital of France?" overlaps an expenses policy on
 * `what`, `is`, `the`, `of` — enough to drag it under the floor. */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "its",
  "may",
  "must",
  "not",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "there",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => !STOPWORDS.has(token),
  );
}

/** Maps a word onto one dimension. Collisions are expected and harmless here. */
function dimensionFor(token: string, dimensions: number): number {
  const digest = createHash("sha256").update(token).digest();

  return digest.readUInt32BE(0) % dimensions;
}

export function fakeEmbedding(
  text: string,
  dimensions: number = EMBEDDING_DIMENSIONS,
): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const index = dimensionFor(token, dimensions);
    // Counted rather than set, so a word repeated through a passage weighs more
    // than one mentioned once. `?? 0` satisfies `noUncheckedIndexedAccess`,
    // which types every indexed read as possibly undefined.
    vector[index] = (vector[index] ?? 0) + 1;
  }

  if (tokens.length === 0) {
    // An all-zero vector cannot be normalized — it has no direction — and would
    // divide by zero downstream. Text that is empty or entirely stopwords gets
    // one fixed direction of its own instead.
    vector[0] = 1;
  }

  return vector;
}

export function fakeEmbeddings(
  texts: readonly string[],
  dimensions: number = EMBEDDING_DIMENSIONS,
): number[][] {
  return texts.map((text) => fakeEmbedding(text, dimensions));
}
