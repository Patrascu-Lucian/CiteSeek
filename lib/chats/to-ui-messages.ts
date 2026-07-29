import {
  type ChatSource,
  type ChatUIMessage,
  SOURCES_PART_ID,
} from "@/lib/ai/types";
import type { ChatMessage } from "./queries";

/**
 * Turning a stored conversation back into what the client renders.
 *
 * A reloaded message has to be indistinguishable from a streamed one, or the
 * chips stop working after a refresh. That means rebuilding the `data-sources`
 * part from the stored citations, in the same shape and the same order the route
 * wrote it during streaming.
 *
 * The `marker` is the array position, not a stored field, which is why
 * `appendMessages` saves the **whole numbered source list** rather than only the
 * passages the model happened to cite. Saving a subset would renumber it here and
 * silently repoint every marker in the text.
 */
export function toUIMessages(stored: readonly ChatMessage[]): ChatUIMessage[] {
  return stored.map((message) => {
    if (message.role === "user" || message.citations.length === 0) {
      return {
        id: message.id,
        role: message.role,
        parts: [{ type: "text", text: message.content }],
      };
    }

    const sources: ChatSource[] = message.citations.map((citation, index) => ({
      ...citation,
      marker: index + 1,
    }));

    return {
      id: message.id,
      role: "assistant",
      parts: [
        { type: "data-sources", id: SOURCES_PART_ID, data: sources },
        { type: "text", text: message.content },
      ],
    };
  });
}
