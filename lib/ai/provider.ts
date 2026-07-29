import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

import { fakeChatModel } from "./fake-chat-model";

/**
 * The one place a model provider is chosen.
 *
 * ADR 007 records this as a structural commitment rather than a vendor one:
 * nothing else in the app imports a provider SDK, so switching provider is a
 * change to this file rather than a refactor across every route. It is also the
 * seam Milestone 6's local (in-browser) mode plugs into.
 */

/** Set `EMBEDDINGS_PROVIDER=fake` to run the full pipeline with no API key. */
export type EmbeddingsProviderName = "google" | "fake";

/**
 * Only the variables actually read, rather than `NodeJS.ProcessEnv`. The full
 * type demands `NODE_ENV`, which would force every caller and test to supply an
 * irrelevant value just to satisfy the signature.
 */
export type ProviderEnv = {
  EMBEDDINGS_PROVIDER?: string | undefined;
  CHAT_PROVIDER?: string | undefined;
  GOOGLE_GENERATIVE_AI_API_KEY?: string | undefined;
  // Index signature so `process.env` is assignable. Without it TypeScript's
  // weak-type check rejects an all-optional target that shares no declared
  // property with `NodeJS.ProcessEnv`.
  [key: string]: string | undefined;
};

export const EMBEDDING_MODEL_ID = "gemini-embedding-001";

/**
 * `gemini-embedding-001`, deliberately not `-2`.
 *
 * The newer model returns a *single aggregated* embedding for multiple inputs
 * and does not accept `taskType`. RAG needs one vector per chunk, plus
 * asymmetric embedding — `RETRIEVAL_DOCUMENT` when indexing and
 * `RETRIEVAL_QUERY` when searching — so `-2` would quietly produce a retrieval
 * system that cannot retrieve. See ADR 002.
 */
export function resolveEmbeddingsProvider(
  env: ProviderEnv = process.env,
): EmbeddingsProviderName {
  const configured = env.EMBEDDINGS_PROVIDER?.trim().toLowerCase();

  if (configured === "fake") return "fake";
  if (configured === "google") return "google";

  if (configured) {
    throw new Error(
      `Unknown EMBEDDINGS_PROVIDER "${configured}". Expected "google" or "fake".`,
    );
  }

  // Unset means real. Defaulting to the fake would let a misconfigured
  // production deploy silently fill the database with meaningless vectors --
  // an outage that looks like poor answer quality rather than a failure.
  return "google";
}

export function getGoogleEmbeddingModel(
  env: ProviderEnv = process.env,
): EmbeddingModel {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Set it, or set EMBEDDINGS_PROVIDER=fake to run without a key.",
    );
  }

  const google = createGoogleGenerativeAI({ apiKey });

  // `embedding()` rather than `textEmbedding()`, which is deprecated in
  // @ai-sdk/google 4.x.
  return google.embedding(EMBEDDING_MODEL_ID);
}

/* ---------------------------------------------------------------------------
 * Generation. Same seam, same rules — a second provider knob rather than one
 * shared switch, because embedding and generation fail differently and are
 * plausibly served by different vendors.
 * ------------------------------------------------------------------------- */

/** Set `CHAT_PROVIDER=fake` to run chat with no API key. */
export type ChatProviderName = "google" | "fake";

/**
 * `gemini-3.5-flash-lite`, pinned rather than the `gemini-flash-lite-latest`
 * alias.
 *
 * A floating alias silently changes what the model does — and generation
 * behavior is precisely what must not change without a decision, since the
 * grounding and citation rules in `prompt.ts` are tuned against it. This is the
 * same hazard ADR 003 exists for. See ADR 012.
 */
export const CHAT_MODEL_ID = "gemini-3.5-flash-lite";

export function resolveChatProvider(
  env: ProviderEnv = process.env,
): ChatProviderName {
  const configured = env.CHAT_PROVIDER?.trim().toLowerCase();

  if (configured === "fake") return "fake";
  if (configured === "google") return "google";

  if (configured) {
    throw new Error(
      `Unknown CHAT_PROVIDER "${configured}". Expected "google" or "fake".`,
    );
  }

  // Unset means real, for the same reason as embeddings: a production deploy
  // that quietly served canned answers would look like a bad model rather than
  // a misconfiguration.
  return "google";
}

export function getChatModel(env: ProviderEnv = process.env): LanguageModel {
  if (resolveChatProvider(env) === "fake") return fakeChatModel();

  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Set it, or set CHAT_PROVIDER=fake to run without a key.",
    );
  }

  return createGoogleGenerativeAI({ apiKey })(CHAT_MODEL_ID);
}
