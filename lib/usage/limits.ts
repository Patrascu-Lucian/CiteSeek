import type { UsageLimits } from "./config";

/**
 * The admission decision, as a pure function over counts.
 *
 * No database, no request, no clock — the same shape as `accessToWorkspace`, and
 * for the same reason: this is the rule, and a rule that can only be exercised
 * by standing up a request is a rule nobody tests at its edges.
 */

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

/**
 * Two refusals, deliberately distinct.
 *
 * `rate_limited` is transient and the caller should try again shortly.
 * `capacity_reached` is not — nothing they do in the next minute changes it, and
 * offering a retry would be a lie. The client renders them differently for that
 * reason, so the distinction is part of the contract rather than a detail.
 */
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

/**
 * Capacity is checked before rate.
 *
 * A caller who is both out of daily quota and going too fast would otherwise be
 * told to retry in a minute, which is false — the daily window will not have
 * moved. The less recoverable answer is the more honest one, so it wins.
 */
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

/**
 * What the caller is told.
 *
 * Kept here beside the decision so the wording cannot drift from the rule it
 * describes. Neither message names a number: thresholds are provisional, and a
 * message quoting one becomes wrong the first time it is tuned.
 */
export function refusalMessage(reason: LimitRefusal): string {
  return reason === "rate_limited"
    ? "Too many requests in a short time. Wait a moment and try again."
    : "The daily capacity for this demo has been reached. It resets within 24 hours.";
}
