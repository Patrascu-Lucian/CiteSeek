import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel } from "ai";

import { fakeChatModel } from "./fake-chat-model";

/** The one place a provider is chosen — nothing else imports a provider SDK, so
 * switching is a change to this file (ADR 007). Also the seam the in-browser
 * mode plugs into. */

/** Set `EMBEDDINGS_PROVIDER=fake` to run the full pipeline with no API key. */
export type EmbeddingsProviderName = "google" | "fake";

/** Only the variables read: `NodeJS.ProcessEnv` demands `NODE_ENV`, forcing every
 * test to supply an irrelevant value. */
export type ProviderEnv = {
  EMBEDDINGS_PROVIDER?: string | undefined;
  CHAT_PROVIDER?: string | undefined;
  GOOGLE_GENERATIVE_AI_API_KEY?: string | undefined;
  // Index signature so `process.env` is assignable — the weak-type check rejects
  // an all-optional target otherwise.
  [key: string]: string | undefined;
};

export const EMBEDDING_MODEL_ID = "gemini-embedding-001";

/** `-001`, not `-2`: the newer model returns a *single aggregated* embedding for
 * multiple inputs and rejects `taskType`, so it would quietly produce a retrieval
 * system that cannot retrieve. ADR 002. */
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

  // Unset means real: defaulting to the fake fills production with meaningless
  // vectors, an outage that looks like poor answer quality.
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

/* Generation. A second knob rather than one shared switch: the two fail
 * differently and are plausibly served by different vendors. */

/** Set `CHAT_PROVIDER=fake` to run chat with no API key. */
export type ChatProviderName = "google" | "fake";

/** Pinned, not the `-latest` alias: a floating alias silently changes behavior
 * the grounding and citation rules are tuned against. ADR 012. */
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

  // Unset means real: canned answers in production look like a bad model.
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
