import type { ChatUIMessage } from "./types";

/** Shared because each mode had written its own and they disagreed, so the same
 * transcript reached retrieval as a different string. Only text parts count —
 * `parts` can also carry tool calls and data. */
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

/** The id the client gave the question, so a stored turn can be named by the
 * message the reader is looking at. */
export function questionIdFrom(
  messages: readonly ChatUIMessage[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.role === "user") return message.id ?? null;
  }

  return null;
}
