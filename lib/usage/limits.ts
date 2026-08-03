import type { UsageLimits } from "./config";

/** The admission decision as a pure function over counts. No database, request
 * or clock — a rule that needs a live request to exercise is a rule nobody tests
 * at its edges. */

export type ActorType = "user" | "guest";

/** What the caller has already spent, read once before the decision. */
export type UsageSnapshot = {
  actorType: ActorType;
  /** This caller's calls in the last minute. */
  requestsInLastMinute: number;
  /** This caller's calls in the last day. */
  requestsToday: number;
  /** Everyone's calls in the last day. */
  globalRequestsToday: number;
};

/** `rate_limited` is transient; `capacity_reached` is not, and offering a retry
 * for it would be a lie. The client renders them differently, so the distinction
 * is contract rather than detail. */
export type LimitRefusal = "rate_limited" | "capacity_reached";

export type LimitDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "rate_limited";
      /** Seconds until the rolling minute window can have moved. */
      retryAfterSeconds: number;
    }
  | { allowed: false; reason: "capacity_reached"; scope: "caller" | "global" };

/** The rolling window the burst guard counts over. */
export const RATE_WINDOW_SECONDS = 60;

/** Capacity before rate: someone both out of quota and going too fast would
 * otherwise be told to retry in a minute, which is false. */
export function decideUsage(
  snapshot: UsageSnapshot,
  limits: UsageLimits,
): LimitDecision {
  const isGuest = snapshot.actorType === "guest";

  if (snapshot.globalRequestsToday >= limits.globalRequestsPerDay) {
    return { allowed: false, reason: "capacity_reached", scope: "global" };
  }

  // The reserve: guests stop while there is still headroom left, so the owner's
  // own workspace survives a bot on the public demo.
  if (
    isGuest &&
    snapshot.globalRequestsToday >= limits.guestGlobalRequestsPerDay
  ) {
    return { allowed: false, reason: "capacity_reached", scope: "global" };
  }

  const dailyCap = isGuest
    ? limits.guestRequestsPerDay
    : limits.userRequestsPerDay;

  if (snapshot.requestsToday >= dailyCap) {
    return { allowed: false, reason: "capacity_reached", scope: "caller" };
  }

  const burstCap = isGuest
    ? limits.guestRequestsPerMinute
    : limits.userRequestsPerMinute;

  if (snapshot.requestsInLastMinute >= burstCap) {
    return {
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: RATE_WINDOW_SECONDS,
    };
  }

  return { allowed: true };
}

/** Beside the decision so wording cannot drift from the rule. No message names a
 * number — thresholds are provisional. */
export function refusalMessage(reason: LimitRefusal): string {
  return reason === "rate_limited"
    ? "Too many requests in a short time. Wait a moment and try again."
    : "The daily capacity for this demo has been reached. It resets within 24 hours.";
}

/** One wire shape for both directions: our cap refuses before the stream opens
 * as a JSON 429, the provider's arrives mid-stream after a 200 has been sent.
 * Identical JSON means the client parses one shape, not two. */
export type RefusalBody = {
  error: string;
  code: LimitRefusal;
};

export function refusalBody(reason: LimitRefusal): RefusalBody {
  return { error: refusalMessage(reason), code: reason };
}

/**
 * The transport throws `new Error(response.text())` on non-2xx and wraps a
 * mid-stream error part the same way, so the status code is gone and the body is
 * the only classification available.
 *
 * Null for anything unrecognized, so an HTML error page falls through to the
 * generic state rather than being misreported as a limit.
 */
export function parseRefusal(error: unknown): LimitRefusal | null {
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

  const code = (parsed as { code?: unknown }).code;

  return code === "rate_limited" || code === "capacity_reached" ? code : null;
}
