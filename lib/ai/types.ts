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
 * The message shape shared by the route and the client.
 *
 * The `sources` data part is what carries citations. It is written *before* the
 * model's text, so a `[1]` arriving mid-stream already has something to resolve
 * against — chips appear as the answer is typed rather than after it finishes.
 */
export type ChatUIMessage = UIMessage<never, { sources: ChatSource[] }>;
