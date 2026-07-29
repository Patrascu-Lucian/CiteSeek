import { createHash } from "node:crypto";

import { EMBEDDING_DIMENSIONS } from "@/lib/rag/vector";

/**
 * A deterministic stand-in for a real embedding provider.
 *
 * Ingestion and retrieval are the widest code paths in the project, and without
 * this they could only be exercised with a live API key — which means CI cannot
 * run them, E2E cannot run them, and nobody can develop offline. Those are the
 * conditions under which a pipeline goes untested and breaks silently.
 *
 * This is a **hashing bag-of-words vectorizer**: each word is hashed to a
 * dimension and counted there. That is a real technique, not a toy — it is what
 * a `HashingVectorizer` does — and it buys the one property a pure hash of the
 * whole string cannot give: **text that shares words lands close together.**
 *
 * That matters because a hash of the entire input makes "how are expenses
 * reimbursed?" orthogonal to the passage answering it, so the only query that
 * could ever retrieve anything is one identical to a stored passage. No
 * realistic question is. The end-to-end test would have had nothing to click.
 *
 * What it emphatically is not is semantic. "Reimbursement" and "expenses" are
 * unrelated to it; only literal word overlap counts. It proves the pipeline
 * stores, retrieves and orders correctly. Retrieval *quality* can only be judged
 * against the real provider, and the relevance floor must not be tuned against
 * these numbers.
 *
 * Deliberately returns un-normalized vectors so that the real and fake paths
 * share one normalization step rather than each having their own.
 */

/**
 * Words carrying no signal, removed so two unrelated sentences do not look
 * similar merely for both being English. Without this, "what is the capital of
 * France?" overlaps an expenses policy on `what`, `is`, `the` and `of` — enough
 * to drag an unrelated question under the relevance floor and quietly break the
 * refusal path this project is built around.
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
