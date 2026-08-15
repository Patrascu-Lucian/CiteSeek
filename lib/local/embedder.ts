import type { EmbeddingsProviderName } from "@/lib/ai/provider";
import type { Embedder, EmbeddingResult } from "@/lib/rag/embeddings";

/**
 * Pinned, not a range: the stored vectors are only comparable to each other, so
 * a model change invalidates every embedding in the browser.
 */
export const LOCAL_EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";

/** What this model produces. `EMBEDDING_DIMENSIONS` is 768 to match the
 * `vector(768)` column, and does not apply to anything stored locally. */
export const LOCAL_EMBEDDING_DIMENSIONS = 384;

/**
 * bge is asymmetric through an instruction rather than an API parameter: the
 * query carries it, the passage does not. Dropping it costs recall, and nothing
 * fails — the two sides simply land further apart than they should.
 */
const QUERY_INSTRUCTION =
  "Represent this sentence for searching relevant passages: ";

type FeatureExtraction = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let loading: Promise<FeatureExtraction> | null = null;

/** Cached across calls: the weights are tens of megabytes, and every ingest and
 * every question would otherwise pay for them again. */
function load(): Promise<FeatureExtraction> {
  loading ??= import("@huggingface/transformers")
    .then(({ env, pipeline }) => {
      // From this origin, not the CDN default — ADR 032.
      env.backends.onnx.wasm!.wasmPaths = "/onnx/";

      return pipeline("feature-extraction", LOCAL_EMBEDDING_MODEL, {
        dtype: "fp32",
      });
    })
    .catch((cause: unknown) => {
      // Cleared, or `??=` would cache the *rejection*: one dropped connection
      // during a 30 MB download and every later attempt fails instantly, which
      // makes the "try again" the caller offers impossible to satisfy.
      loading = null;
      throw cause;
    });

  return loading;
}

/** A runtime flag, not a build-time one, so CI's E2E job runs the exact build
 * the gate produced. It only changes which vectors this browser writes for its
 * own documents — no server, no account, no other reader. */
export async function resolveLocalEmbedder(): Promise<Embedder> {
  if (resolveLocalProvider() === "local-fake") {
    return (await import("./fake-embedder")).fakeLocalEmbedder;
  }

  return localEmbedder;
}

/** From the same flag as the embedder, because the two cannot be chosen
 * separately: judging fake vectors by the real model's floor refuses everything. */
export function resolveLocalProvider(): EmbeddingsProviderName {
  const flagged = (globalThis as { __citeseekLocalEmbedder?: string })
    .__citeseekLocalEmbedder;

  return flagged === "fake" ? "local-fake" : "local";
}

export const localEmbedder: Embedder = async (
  texts,
  taskType,
): Promise<EmbeddingResult> => {
  const extract = await load();

  const prepared = texts.map((text) =>
    taskType === "RETRIEVAL_QUERY" ? `${QUERY_INSTRUCTION}${text}` : text,
  );

  const output = await extract(prepared, { pooling: "mean", normalize: true });

  // Zero, like the fake: this model runs on the reader's machine and bills
  // nobody, and reporting an estimate would put invented numbers in the usage
  // dashboard.
  return { vectors: output.tolist(), tokens: 0 };
};
