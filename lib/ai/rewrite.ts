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
/** Half of the route's `maxDuration`. */
const REWRITE_TIMEOUT_MS = 30_000;

/* "Question", not "search query": a query returns keyword bags — `deposit cat` —
   that embed nowhere near the passage answering them, and it is this string the
   reader is shown under "Searched for". Recall@3 0.90 against 1.00, in
   `docs/backlog.md`, which also has what a question form costs in return. */
const SYSTEM = [
  "Rewrite the user's last message as a standalone question.",
  "Use only words and subjects that already appear in the conversation.",
  "Never introduce a name, number or fact that is not there.",
  "If the last message already stands alone, repeat it unchanged.",
  "Reply with the question and nothing else.",
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
    const { text, usage, finishReason } = await generateText({
      model: getChatModel(),
      system: SYSTEM,
      prompt: history,
      // Questions run longer than the keyword bags this was sized for.
      // `MAX_CHARS` is the real bound.
      maxOutputTokens: 96,
      // Asked for, not delivered: two runs of one prompt disagreed on two of ten
      // rows (`docs/backlog.md`). Bounds sampling; promises nothing across
      // requests.
      temperature: 0,
      // Half the route's budget: past this the refusal is worth more than the
      // retry.
      abortSignal: AbortSignal.timeout(REWRITE_TIMEOUT_MS),
    });

    // A cut-off question is still under `MAX_CHARS`, so nothing else rejects it —
    // and it would be shown to the reader as what we searched for.
    if (finishReason === "length") return null;

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
