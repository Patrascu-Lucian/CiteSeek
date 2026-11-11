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

type TextPart = { type: "text"; text: string };
type TextTurn = { id: string; role: "user" | "assistant"; parts: TextPart[] };

function isTextPart(part: unknown): part is TextPart {
  const { type, text } = (part ?? {}) as { type?: unknown; text?: unknown };
  return type === "text" && typeof text === "string";
}

function textOf(turn: TextTurn): string {
  return turn.parts.map((part) => part.text).join("");
}

/**
 * The turns, reduced to the one part the model may see: text. `convertToModelMessages`
 * passes on whatever arrives — a `system` turn as a second system prompt, a file
 * as model input the bounds below never counted. A question carrying anything
 * but text is refused, since the page sends none; an assistant turn's tool,
 * reasoning and data parts are dropped instead, because a live conversation
 * sends them back.
 */
export function parseMessages(body: unknown): ChatUIMessage[] | null {
  const { messages } = (body ?? {}) as { messages?: unknown };
  if (!Array.isArray(messages)) return null;
  if (messages.length === 0 || messages.length > MAX_REQUEST_MESSAGES)
    return null;

  const turns: TextTurn[] = [];
  for (const message of messages as unknown[]) {
    const { id, role, parts } = (message ?? {}) as {
      id?: unknown;
      role?: unknown;
      parts?: unknown;
    };
    if (role !== "user" && role !== "assistant") return null;
    if (!Array.isArray(parts)) return null;

    // Rebuilt, not passed on: a text part's `providerMetadata` reaches the
    // provider as options.
    const text = parts
      .filter(isTextPart)
      .map((part): TextPart => ({ type: "text", text: part.text }));
    if (role === "user" && text.length !== parts.length) return null;

    turns.push({ id: typeof id === "string" ? id : "", role, parts: text });
  }

  const total = turns.reduce((sum, turn) => sum + textOf(turn).length, 0);
  if (total > MAX_TOTAL_CHARS) return null;
  if (textOf(turns[turns.length - 1]!).length > MAX_QUESTION_CHARS) return null;

  return turns;
}
