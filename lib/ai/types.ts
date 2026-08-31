import type { UIMessage } from "ai";

import type { MessageCitation, RefusalReason } from "@/lib/db/schema";

/**
 * The model chooses *which* marker to write and never what it points at, which is
 * what makes a fabricated citation impossible rather than discouraged — a marker
 * with no source renders as plain text. Its own module because the client imports
 * it, and a type-only import from the prompt builder is one refactor away from
 * pulling prompt strings into the browser bundle.
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
 * `sources` is written *before* the model's text, so a `[1]` arriving mid-stream
 * has something to resolve against. `refusal` is its mirror — a reason, never
 * prose, so nothing a reader is offered comes from a model. `searchedFor` is set
 * only when a second attempt found what the typed question could not, because a
 * wrong guess has to be visible (ADR 044, ADR 048).
 */
export type ChatUIMessage = UIMessage<
  ChatMessageMetadata,
  { sources: ChatSource[]; refusal: { reason: RefusalReason } }
>;
