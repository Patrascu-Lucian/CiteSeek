import type { ChatUIMessage } from "./types";

/*
  Bounds on one chat request's shape. The limiter counts requests, not size, so
  without these one enormous turn passes a cap built for a normal one.

  Not in `route.ts`: its export surface is closed to Next's own keys, so nothing
  there can be imported by a test — not the parser below, nor the constant the
  saved-message cap is tied to.
*/

export const MAX_REQUEST_MESSAGES = 100;
export const MAX_TOTAL_CHARS = 200_000;
export const MAX_QUESTION_CHARS = 8_000;

function textOf(message: ChatUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
}

export function parseMessages(body: unknown): ChatUIMessage[] | null {
  if (typeof body !== "object" || body === null) return null;

  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) return null;
  if (messages.length === 0 || messages.length > MAX_REQUEST_MESSAGES)
    return null;

  const valid = messages.every(
    (message: unknown) =>
      typeof message === "object" &&
      message !== null &&
      "role" in message &&
      "parts" in message &&
      Array.isArray((message as { parts: unknown }).parts),
  );

  if (!valid) return null;

  const parsed = messages as ChatUIMessage[];
  const total = parsed.reduce(
    (sum, message) => sum + textOf(message).length,
    0,
  );
  if (total > MAX_TOTAL_CHARS) return null;

  const last = parsed[parsed.length - 1];
  if (last && textOf(last).length > MAX_QUESTION_CHARS) return null;

  return parsed;
}
