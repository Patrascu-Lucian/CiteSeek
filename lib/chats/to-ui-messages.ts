import {
  type ChatSource,
  type ChatUIMessage,
  REFUSAL_PART_ID,
  SOURCES_PART_ID,
} from "@/lib/ai/types";
import type { ChatMessage } from "./queries";

/**
 * A reloaded message must be indistinguishable from a streamed one, or chips stop
 * working after a refresh.
 *
 * `marker` is the array position, not a stored field, which is why
 * `appendMessages` saves the **whole numbered list** — a subset would renumber
 * here and repoint every marker. A refusal rebuilds its `data-refusal` part from
 * the stored reason for the same reason.
 */
export function toUIMessages(stored: readonly ChatMessage[]): ChatUIMessage[] {
  return stored.map((message) => {
    if (message.role === "user") {
      return {
        id: message.id,
        role: message.role,
        parts: [{ type: "text", text: message.content }],
      };
    }

    // Before citations: the two are mutually exclusive, and a row carrying both
    // means the refusal wins over a source list that should not exist.
    if (message.refusalReason) {
      return {
        id: message.id,
        role: "assistant",
        parts: [
          {
            type: "data-refusal",
            id: REFUSAL_PART_ID,
            data: { reason: message.refusalReason },
          },
          { type: "text", text: message.content },
        ],
      };
    }

    if (message.citations.length === 0) {
      return {
        id: message.id,
        role: "assistant",
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
