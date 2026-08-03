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
 * `gemini-embedding-001` is **asymmetric**: the same text embedded as a query
 * lands elsewhere than embedded as a document. Mixing them degrades retrieval in
 * a way that looks like poor chunking, which is why the two entry points are
 * separate functions rather than a boolean.
 */

type EmbedOptions = {
  /** Injectable for tests; defaults to the configured provider. */
  embedder?: Embedder;
  signal?: AbortSignal;
};

/** Tokens carried rather than discarded: embedding is billed and quota-limited,
 * and a ceiling can only be enforced over numbers something reports. */
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

/** Bounded: request-per-minute limits are the binding constraint on a 600-chunk
 * document, and firing every batch at once fails the ingest. */
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

  // A provider reporting no usage should cost zero, not crash a 600-chunk upload
  // over an accounting detail.
  return { vectors: embeddings, tokens: usage?.tokens ?? 0 };
};

const fakeEmbedder: Embedder = (texts) =>
  Promise.resolve({ vectors: fakeEmbeddings(texts), tokens: 0 });

export function getEmbedder(): Embedder {
  return resolveEmbeddingsProvider() === "fake" ? fakeEmbedder : googleEmbedder;
}

/** The single normalization point: `l2Normalize` is idempotent mathematically but
 * not bit-exact, so doing it again downstream perturbs stored values. */
async function embedWithTaskType(
  texts: readonly string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  options: EmbedOptions,
): Promise<EmbeddingResult> {
  if (texts.length === 0) return { vectors: [], tokens: 0 };

  const embedder = options.embedder ?? getEmbedder();
  const { vectors, tokens } = await embedder(texts, taskType, options.signal);

  if (vectors.length !== texts.length) {
    // The `-2` failure mode: many inputs collapsing to one aggregated vector.
    // Caught here rather than as an off-by-one deep in the ingestion loop.
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

/** Returns token cost with the vector: a query is embedded *before* the floor
 * applies, so a question that retrieved nothing was still paid for. */
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
