/** The cap decision as a pure function over counts. No database, request or
 * clock — a rule that needs a live request to exercise is a rule nobody tests at
 * its edges. */

export type CapKind = "documents" | "conversations";

export type CapReached = {
  allowed: false;
  reason: "cap_reached";
  cap: CapKind;
  limit: number;
  current: number;
};

export type CapDecision = { allowed: true } | CapReached;

/** `>=`, not `>`: the caller is about to add one.
 *
 * Check-then-insert runs in no transaction, and `UploadDropzone` fires its
 * uploads concurrently, so two requests can both pass at `limit - 1`. The
 * overshoot is accepted rather than locked against — `>=` means the next attempt
 * refuses and the count converges. ADR 039. */
export function decideCap(
  cap: CapKind,
  current: number,
  limit: number,
): CapDecision {
  return current >= limit
    ? { allowed: false, reason: "cap_reached", cap, limit, current }
    : { allowed: true };
}

/**
 * How a cap refusal survives a redirect.
 *
 * `/c/new` is a form POST, so its refusal cannot be a JSON body — the browser
 * would render it. It redirects back and the workspace names the cap through
 * this parameter instead. Read by `app/(app)/w/[workspaceId]/page.tsx`.
 */
export const CAP_PARAM = "limit";

/** What the message needs beyond the decision, per cap. */
export type CapMessageContext = { failedDocuments?: number };

/** What was reached, and the move that resolves it. Split because a rendered
 * notice needs the two separately and an HTTP body needs them joined. */
export type CapCopy = { title: string; detail: string };

/**
 * Beside the decision so wording cannot drift from the rule.
 *
 * These name their number, where `lib/usage`'s deliberately do not: a rolling
 * threshold is provisional, but a stock limit *is* the number, and a reader who
 * cannot tell how many to delete was given a feeling rather than a rule.
 */
export function capRefusalCopy(
  decision: CapReached,
  context: CapMessageContext = {},
): CapCopy {
  switch (decision.cap) {
    case "documents": {
      const title = `You have reached the limit of ${decision.limit} documents.`;
      const failed = context.failedDocuments ?? 0;

      // The failed count is named because it is the actionable case: a reader at
      // the cap with nothing usable would otherwise be told to delete a working
      // document.
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
  }
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
export type CapRefusalBody = {
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
  return {
    error: capRefusalMessage(decision, context),
    code: decision.reason,
    cap: decision.cap,
    limit: decision.limit,
    current: decision.current,
  };
}
