import type { EmbeddingsProviderName } from "@/lib/ai/provider";

/**
 * Retrieval tuning, kept apart from the query that uses it.
 *
 * `retrieve.ts` imports the database, so anything importing *it* inherits a
 * connection — which a unit test asserting a distance has no business needing.
 * These are plain numbers; they should be reachable without one.
 */

/**
 * The relevance floor is a property of the **embedding model**, not of the
 * product.
 *
 * Cosine distance only means something relative to the vectors that produced it,
 * and two models put "relevant" in completely different numeric ranges. A single
 * shared constant would therefore be wrong for one of them, and wrong in the
 * worst direction: too low and every question is refused, too high and nothing
 * is.
 *
 * This is not a test convenience. It is the same reason the code has always said
 * the floor cannot be tuned against the fake embedder — that statement only has
 * teeth if the two numbers are actually allowed to differ.
 */
export const MAX_DISTANCE_BY_PROVIDER: Record<EmbeddingsProviderName, number> =
  {
    /**
     * `gemini-embedding-001`. **Provisional** — needs tuning against real
     * documents, which is the one thing no test here can do for us.
     */
    google: 0.6,

    /**
     * The bag-of-words fake sits in a much narrower band, for a reason worth
     * understanding: cosine similarity between a short question and a long passage
     * is inherently small. A six-word query against a passage with a hundred
     * distinct words cannot exceed roughly 0.25 similarity even if every query
     * word appears — the passage's vector spreads its mass over far more
     * dimensions. Real embedding models avoid this by being dense semantic
     * encoders rather than word counters.
     *
     * So a threshold that works for Gemini rejects everything here. Calibrated
     * instead against the seeded fixture: a question about its contents lands
     * around 0.80, an unrelated one at 0.95 and above.
     */
    fake: 0.88,
  };

export function maxDistanceFor(provider: EmbeddingsProviderName): number {
  return MAX_DISTANCE_BY_PROVIDER[provider];
}

/** Passages per answer. Enough context to answer from, few enough to stay grounded. */
export const RETRIEVAL_LIMIT = 8;
