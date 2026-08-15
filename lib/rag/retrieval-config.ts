import type { EmbeddingsProviderName } from "@/lib/ai/provider";

/** Apart from `retrieve.ts`, which imports the database — a unit test asserting a
 * distance has no business inheriting a connection. */

/**
 * The relevance floor belongs to the **embedding model**, not the product: cosine
 * distance only means something relative to the vectors that produced it, and two
 * models put "relevant" in different numeric ranges. One shared constant would be
 * wrong for one of them — too low refuses everything, too high refuses nothing.
 */
export const MAX_DISTANCE_BY_PROVIDER: Record<EmbeddingsProviderName, number> =
  {
    /**
     * `gemini-embedding-001`, measured rather than guessed — `pnpm eval:retrieval`,
     * written up in ADR 020. At the previous `0.6` the floor admitted every
     * ungrounded question in the set; the two distance distributions overlap, so
     * this is the least bad point on a trade rather than a separating value.
     */
    google: 0.4,

    /**
     * The bag-of-words fake sits in a narrower band: cosine similarity between a
     * short query and a long passage is inherently small — six words against a
     * hundred distinct ones cannot exceed ~0.25 even if every word appears, since
     * the passage spreads its mass over more dimensions. Dense encoders avoid
     * this; word counters cannot.
     *
     * Calibrated against the seeded fixture: on-topic ~0.80, unrelated ≥0.95.
     */
    fake: 0.88,

    /** `bge-small-en-v1.5`, measured by `pnpm eval:local`; the trade against
     * 0.55 is in ADR 031. Higher than Google's only because 384 dimensions
     * arrange distances differently — recall@8 is 100%. */
    local: 0.5,

    /** The browser fake, and not `fake` above: different hash, different width,
     * so that 0.88 would answer "what is the capital of France". Measured on the
     * demo handbook — on-topic 0.70–0.72, unrelated 0.85–0.90. */
    "local-fake": 0.8,
  };

export function maxDistanceFor(provider: EmbeddingsProviderName): number {
  return MAX_DISTANCE_BY_PROVIDER[provider];
}

/** Passages per answer. Enough context to answer from, few enough to stay grounded. */
export const RETRIEVAL_LIMIT = 8;
