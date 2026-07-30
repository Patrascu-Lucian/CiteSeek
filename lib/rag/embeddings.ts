import { embedMany } from "ai";

import { fakeEmbeddings } from "@/lib/ai/fake-embedder";
import {
  getGoogleEmbeddingModel,
  resolveEmbeddingsProvider,
} from "@/lib/ai/provider";

import {
  EMBEDDING_DIMENSIONS,
  assertEmbeddingShape,
  l2Normalize,
} from "./vector";

/**
 * Turning text into vectors.
 *
 * Passages and queries are embedded with *different* task types. This is not a
 * detail: `gemini-embedding-001` produces asymmetric embeddings, so a passage
 * embedded as a query lands in a different part of the space than the same
 * passage embedded as a document. Mixing them degrades retrieval in a way that
 * looks like poor chunking rather than a configuration error, which is why the
 * two entry points below are separate functions rather than a boolean argument.
 */

type EmbedOptions = {
  /** Injectable for tests; defaults to the configured provider. */
  embedder?: Embedder;
  signal?: AbortSignal;
};

/**
 * What a provider returns: the vectors, and what they cost.
 *
 * The token count is carried rather than discarded because embedding is billed
 * and quota-limited like generation is, and a cost ceiling can only be enforced
 * over numbers something actually reports. `embedMany` returns usage; this seam
 * used to drop it on the floor, which made "what has this workspace spent?" a
 * question with no answer.
 */
export type EmbeddingResult = {
  vectors: number[][];
  /** Total tokens consumed. Zero from the fake, which costs nothing. */
  tokens: number;
};

/** The seam ingestion depends on, so it never imports a provider directly. */
export type Embedder = (
  texts: readonly string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  signal?: AbortSignal,
) => Promise<EmbeddingResult>;

/**
 * Bounded rather than unlimited. Free-tier request-per-minute limits are the
 * binding constraint on a 600-chunk document, and firing every batch at once is
 * the fastest way to get rate-limited into a failed ingest.
 */
const MAX_PARALLEL_CALLS = 2;
const MAX_RETRIES = 5;

const googleEmbedder: Embedder = async (texts, taskType, signal) => {
  const { embeddings, usage } = await embedMany({
    model: getGoogleEmbeddingModel(),
    values: [...texts],
    maxParallelCalls: MAX_PARALLEL_CALLS,
    maxRetries: MAX_RETRIES,
    abortSignal: signal,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType,
      },
    },
  });

  // Optional chaining because a provider that reports no usage should cost a
  // zero, not an exception. Embedding is on the ingestion path: crashing a
  // 600-chunk upload because a usage field was absent trades a real feature for
  // an accounting detail.
  return { vectors: embeddings, tokens: usage?.tokens ?? 0 };
};

const fakeEmbedder: Embedder = (texts) =>
  Promise.resolve({ vectors: fakeEmbeddings(texts), tokens: 0 });

export function getEmbedder(): Embedder {
  return resolveEmbeddingsProvider() === "fake" ? fakeEmbedder : googleEmbedder;
}

/**
 * Providers return raw vectors; this is the single point at which they are
 * normalized. `l2Normalize` is mathematically idempotent but not bit-exact, so
 * normalizing again downstream would perturb stored values for no benefit.
 */
async function embedWithTaskType(
  texts: readonly string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  options: EmbedOptions,
): Promise<EmbeddingResult> {
  if (texts.length === 0) return { vectors: [], tokens: 0 };

  const embedder = options.embedder ?? getEmbedder();
  const { vectors, tokens } = await embedder(texts, taskType, options.signal);

  if (vectors.length !== texts.length) {
    // The `gemini-embedding-2` failure mode: multiple inputs collapsing into one
    // aggregated vector. Caught here rather than surfacing as a foreign-key or
    // off-by-one error deep in the ingestion loop.
    throw new Error(
      `Embedding provider returned ${vectors.length} vectors for ${texts.length} inputs. ` +
        `An aggregating model (such as gemini-embedding-2) cannot be used for per-chunk retrieval.`,
    );
  }

  return {
    vectors: vectors.map((vector) => {
      assertEmbeddingShape(vector);
      return l2Normalize(vector);
    }),
    tokens,
  };
}

/** Embed document passages for storage. */
export function embedPassages(
  texts: readonly string[],
  options: EmbedOptions = {},
): Promise<EmbeddingResult> {
  return embedWithTaskType(texts, "RETRIEVAL_DOCUMENT", options);
}

/**
 * Embed a search query.
 *
 * Returns the token cost alongside the vector because a query is embedded
 * *before* the relevance floor is applied — so a question that retrieves nothing
 * has still been paid for. Anything metering usage has to see that, or the
 * cheapest way to spend someone's quota is to ask nonsense.
 */
export async function embedQuery(
  text: string,
  options: EmbedOptions = {},
): Promise<{ vector: number[]; tokens: number }> {
  const { vectors, tokens } = await embedWithTaskType(
    [text],
    "RETRIEVAL_QUERY",
    options,
  );

  return { vector: vectors[0]!, tokens };
}
