import { generateText } from "ai";

import { getChatModel } from "./provider";
import type { ChatUIMessage } from "./types";

/** Only reached when retrieval returned nothing, so the answered path never waits
 * on a second model call (ADR 044). Measured worth: 3 questions in 10. */

/** Enough for the subject to still be on screen, short enough that a long
 * transcript does not price a refusal like an answer. */
const TURNS = 6;
/** A rewrite is one question. Anything longer is the model explaining itself. */
const MAX_CHARS = 200;

const SYSTEM = [
  "Rewrite the user's last message as a standalone search query.",
  "Use only words and subjects that already appear in the conversation.",
  "Never introduce a name, number or fact that is not there.",
  "If the last message already stands alone, repeat it unchanged.",
  "Reply with the query and nothing else.",
].join(" ");

/** Null where the rewrite gained nothing, so the caller refuses as it would have
 * without one. Separated from the model call to be testable without it. */
export function acceptRewrite(raw: string, asked: string): string | null {
  const line = raw.trim().split("\n")[0]?.trim() ?? "";
  const unquoted = line.replace(/^["'`]|["'`]$/g, "").trim();

  if (unquoted.length === 0 || unquoted.length > MAX_CHARS) return null;
  if (unquoted.toLowerCase() === asked.trim().toLowerCase()) return null;

  return unquoted;
}

export type Rewrite = {
  question: string;
  inputTokens: number;
  outputTokens: number;
};

export async function rewriteQuestion(
  messages: readonly ChatUIMessage[],
  asked: string,
): Promise<Rewrite | null> {
  const history = messages
    .slice(-TURNS)
    .flatMap((message) =>
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => `${message.role}: ${part.text}`),
    )
    .join("\n");

  // A conversation of one has no subject to recover, and the rewrite would have
  // to invent one to differ.
  if (history.split("\n").length < 2) return null;

  // A best-effort second chance on a turn that has already failed to retrieve.
  // Letting a provider error escape would turn a refusal the reader can act on
  // into a broken stream.
  try {
    const { text, usage } = await generateText({
      model: getChatModel(),
      system: SYSTEM,
      prompt: history,
    });

    const question = acceptRewrite(text, asked);
    if (question === null) return null;

    return {
      question,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  } catch {
    return null;
  }
}
