import type { UIMessage } from "ai";

import type { MessageCitation } from "@/lib/db/schema";

/**
 * One retrieved passage, as the model is told about it and as the client renders
 * it.
 *
 * `marker` is the number the model writes inline — `[1]`, `[2]` — and the client
 * resolves back to this record. The model chooses *which* marker to write; it
 * never supplies what a marker points at. That asymmetry is what makes a
 * fabricated citation impossible rather than merely discouraged: a marker with no
 * matching source renders as plain text, because there is nothing to render.
 *
 * This lives in its own module rather than beside the prompt builder because the
 * client imports it too, and a type-only import from a module full of prompt
 * strings is one refactor away from pulling them into the browser bundle.
 */
export type ChatSource = MessageCitation & {
  /** 1-based. Matches the `[n]` the model writes. */
  marker: number;
  filename: string;
};

/**
 * The id the sources data part is written under.
 *
 * Stable rather than generated: writing the same id again replaces the part
 * rather than appending a second one, so a regenerated answer cannot leave a
 * stale source list behind next to the new one.
 */
export const SOURCES_PART_ID = "sources";

/**
 * Why an answer could not be grounded.
 *
 * Only the two cases the *route* can tell apart without a model. Anything
 * finer-grained would be a guess about what the reader meant, and this whole
 * design rests on the refusal being a fact about retrieval rather than an
 * interpretation of the question.
 */
export type RefusalReason =
  /** Passages exist in this workspace; none of them cleared the relevance floor. */
  | "no_relevant_passages"
  /** Nothing has finished processing, so there was nothing to search at all. */
  | "no_documents";

/** @see SOURCES_PART_ID — same reasoning, stable so a rewrite replaces it. */
export const REFUSAL_PART_ID = "refusal";

/**
 * The message shape shared by the route and the client.
 *
 * The `sources` data part is what carries citations. It is written *before* the
 * model's text, so a `[1]` arriving mid-stream already has something to resolve
 * against — chips appear as the answer is typed rather than after it finishes.
 *
 * The `refusal` part is the mirror image: it appears only when `sources` cannot,
 * and it carries a reason rather than prose. What the reader is then offered —
 * which documents were searched, how to add one — is rendered by the client from
 * its own props. Nothing about the refusal is written by a model, which is the
 * point: a turn that could not be grounded must not produce text that reads as
 * though it were.
 */
export type ChatUIMessage = UIMessage<
  never,
  { sources: ChatSource[]; refusal: { reason: RefusalReason } }
>;
