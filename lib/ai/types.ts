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
