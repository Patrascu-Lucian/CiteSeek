import type { UIMessage } from "ai";

import type { MessageCitation, RefusalReason } from "@/lib/db/schema";

/**
 * One retrieved passage, as the model is told about it and as the client renders
 * it.
 *
 * The model chooses *which* marker to write; it never supplies what a marker
 * points at. That asymmetry is what makes a fabricated citation impossible
 * rather than discouraged — a marker with no matching source renders as plain
 * text.
 *
 * Its own module rather than beside the prompt builder: the client imports this,
 * and a type-only import from a module full of prompt strings is one refactor
 * away from pulling them into the browser bundle.
 */
export type ChatSource = MessageCitation & {
  /** 1-based. Matches the `[n]` the model writes. */
  marker: number;
  filename: string;
};

/**
 * Stable rather than generated, so writing the same id again replaces the part
 * instead of appending a second one — a regenerated answer cannot leave a stale
 * source list beside the new one.
 */
export const SOURCES_PART_ID = "sources";

/**
 * Defined in the schema rather than here: this module already imports
 * `MessageCitation` from it, and defining it here would make the two import each
 * other.
 */
export type { RefusalReason };

/** @see SOURCES_PART_ID — same reasoning. */
export const REFUSAL_PART_ID = "refusal";

/** Message metadata, not a data part: a part written before the model's first
 * token arrives ahead of the `start` opening the message, and the client builds
 * a second message around it. */
export type ChatMessageMetadata = { searchedFor?: string };

/**
 * The message shape shared by the route and the client.
 *
 * `sources` is written *before* the model's text, so a `[1]` arriving mid-stream
 * already has something to resolve against — chips appear as the answer is typed.
 *
 * `refusal` is the mirror image: it appears only when `sources` cannot, and
 * carries a reason rather than prose. What the reader is offered is rendered by
 * the client, so nothing about a refusal is written by a model.
 *
 * `searchedFor` appears only when the typed question retrieved nothing and a
 * rewrite of it did — a wrong guess has to be visible, or an off-topic answer
 * has no explanation (ADR 044).
 */
export type ChatUIMessage = UIMessage<
  ChatMessageMetadata,
  { sources: ChatSource[]; refusal: { reason: RefusalReason } }
>;
