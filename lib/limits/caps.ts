/** The cap decision as a pure function over counts. No database, request or clock. */

export type CapKind = "documents" | "conversations" | "messages" | "storage";

export type CapReached = {
  allowed: false;
  reason: "cap_reached";
  cap: CapKind;
  limit: number;
  current: number;
};

export type CapDecision = { allowed: true } | CapReached;

/** `>=`, not `>`: the caller is about to add one. */
export function decideCap(
  cap: CapKind,
  current: number,
  limit: number,
): CapDecision {
  return current >= limit
    ? { allowed: false, reason: "cap_reached", cap, limit, current }
    : { allowed: true };
}

/** `/c/new` is a form POST, so its refusal cannot be a JSON body — the browser
 * would render it. Carried on the redirect instead, and read by
 * `app/(app)/w/[workspaceId]/page.tsx`. */
export const CAP_PARAM = "limit";

/** What the message needs beyond the decision, per cap. */
export type CapMessageContext = {
  failedDocuments?: number;
  /** Messages only: the advice is "start a new conversation", which is itself
   * capped. Without this it is wrong for the reader who has no move left. */
  conversationsExhausted?: boolean;
};

/** What was reached, and the move that resolves it. Split because a rendered
 * notice needs the two separately and an HTTP body needs them joined. */
export type CapCopy = { title: string; detail: string };

/** Beside the decision so wording cannot drift from the rule. These name their
 * number where `lib/usage`'s deliberately do not: a rolling threshold is
 * provisional, a stock limit *is* the number. */
export function capRefusalCopy(
  decision: CapReached,
  context: CapMessageContext = {},
): CapCopy {
  switch (decision.cap) {
    case "documents": {
      const title = `You have reached the limit of ${decision.limit} documents.`;
      const failed = context.failedDocuments ?? 0;

      // Named, or a reader at the cap with nothing usable is told to delete a
      // working document.
      const detail =
        failed === 0
          ? "Delete one to upload another."
          : failed === 1
            ? "One of them failed to process — deleting that one frees a slot."
            : `${failed} of them failed to process — deleting those frees a slot.`;

      return { title, detail };
    }

    case "conversations":
      return {
        title: `You have reached the limit of ${decision.limit} conversations.`,
        detail: "Delete one below to start another.",
      };

    case "messages":
      return {
        title: `This conversation has reached its limit of ${decision.limit} saved messages.`,
        detail: context.conversationsExhausted
          ? "You have used all your conversations too, so delete one before starting another."
          : "Start a new conversation to keep going — this one stays where it is.",
      };

    case "storage":
      return {
        title: `Your documents have used all ${formatCharacters(decision.limit)} characters of storage.`,
        detail: "Delete one to upload another.",
      };
  }
}

/** Fixed locale, or the same limit reads differently to two readers. */
function formatCharacters(count: number): string {
  return count.toLocaleString("en-US");
}

/** The same rule at ingestion, where this one document crosses the ceiling
 * rather than the reader already being over. Here so the two cannot drift. */
export function storageExceededMessage(limit: number): string {
  return `This document's text would take you past the ${formatCharacters(limit)}-character storage limit. Delete another document, or upload a smaller one.`;
}

export function capRefusalMessage(
  decision: CapReached,
  context: CapMessageContext = {},
): string {
  const { title, detail } = capRefusalCopy(decision, context);
  return `${title} ${detail}`;
}

/** One wire shape, so the client parses a cap refusal the same way whichever cap
 * produced it. `current` and `limit` ride along so Milestone 9's paywall can
 * render the same decision rather than re-derive it. */
export type CapRefusalBody = CapCopy & {
  /** `title` and `detail` joined. Kept for consumers that show one line —
   * `UploadDropzone` renders a single string per rejected file. */
  error: string;
  code: "cap_reached";
  cap: CapKind;
  limit: number;
  current: number;
};

export function capRefusalBody(
  decision: CapReached,
  context: CapMessageContext = {},
): CapRefusalBody {
  const copy = capRefusalCopy(decision, context);

  return {
    ...copy,
    error: `${copy.title} ${copy.detail}`,
    code: decision.reason,
    cap: decision.cap,
    limit: decision.limit,
    current: decision.current,
  };
}

/**
 * Separate from `parseRefusal` on purpose: that one classifies flow refusals,
 * which offer a retry. A cap never does (ADR 039).
 *
 * The transport throws `new Error(response.text())`, so the status code is gone
 * and the body is the only classification available.
 */
export function parseCapRefusal(error: unknown): CapRefusalBody | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  if (!message) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const body = parsed as Partial<CapRefusalBody>;

  // Every field the renderer reads, so a merely JSON-shaped body falls through
  // to the generic error state rather than rendering "undefined" at the reader.
  if (
    body.code !== "cap_reached" ||
    typeof body.title !== "string" ||
    typeof body.detail !== "string" ||
    typeof body.cap !== "string"
  ) {
    return null;
  }

  return body as CapRefusalBody;
}
