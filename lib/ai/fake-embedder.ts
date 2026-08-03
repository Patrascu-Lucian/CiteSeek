import { createHash } from "node:crypto";

import { EMBEDDING_DIMENSIONS } from "@/lib/rag/vector";

/**
 * A deterministic stand-in, so ingestion and retrieval can run without an API key
 * in CI, E2E and offline.
 *
 * A **hashing bag-of-words vectorizer**: each word hashes to a dimension and is
 * counted there. That buys the property a hash of the whole string cannot —
 * **text sharing words lands close together**. Hashing the whole input would
 * make a question orthogonal to the passage answering it, so only a query
 * identical to a stored passage could retrieve anything.
 *
 * Not semantic: "reimbursement" and "expenses" are unrelated here, only literal
 * overlap counts. It proves the pipeline stores, retrieves and orders — not
 * quality, and **the relevance floor must not be tuned against these numbers**.
 *
 * Returns un-normalized vectors so real and fake share one normalization step.
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
