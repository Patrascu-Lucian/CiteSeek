import type { ChatUIMessage } from "./types";

/**
 * Shared because each mode had written its own and they disagreed: local took
 * the last message whatever its role and joined parts with `""`, so the same
 * transcript reached retrieval as a different string. Only text parts are a
 * question — `parts` can also carry tool calls and data.
 */
export function questionFrom(
  messages: readonly ChatUIMessage[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.role !== "user") continue;

    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim();

    return text.length > 0 ? text : null;
  }

  return null;
}
