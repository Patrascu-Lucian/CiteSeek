/**
 * Unset means production, an unknown value throws — a limiter defaulting to "off"
 * is a limiter that is not there, and the failure looks like exhausted quota.
 *
 * **The unit is one provider call, not one question**: an answer writes two rows,
 * a refusal one, an upload one per batch. Counting questions undercounts
 * refusals, which is the traffic an abuser generates. ADR 014.
 */

export type UsageLimits = {
  /** Per-caller ceiling in a rolling minute — the burst guard. */
  guestRequestsPerMinute: number;
  userRequestsPerMinute: number;
  /** Per-caller ceiling in a rolling day — the personal quota. */
  guestRequestsPerDay: number;
  userRequestsPerDay: number;
  /** Everyone's calls in a rolling day — the quota this actually defends. */
  globalRequestsPerDay: number;
  /** Below the global ceiling, with the gap reserved for signed-in users — a bot
   * hammering the demo must not take down the owner's own workspace. */
  guestGlobalRequestsPerDay: number;
};

/** Provisional, anchored on the free tier's ~1,000–1,500 requests a day shared
 * across every key, with room left for seeding and manual testing. */
export const PRODUCTION_USAGE_LIMITS: UsageLimits = {
  // ~4 and ~10 questions a minute. Fast for a human, slow for a script.
  guestRequestsPerMinute: 8,
  userRequestsPerMinute: 20,
  // ~20 and ~100 answered questions a day.
  guestRequestsPerDay: 40,
  userRequestsPerDay: 200,
  globalRequestsPerDay: 800,
  guestGlobalRequestsPerDay: 600,
};

/** Unreachable thresholds, not a flag that skips enforcement: the queries still
 * run, so E2E exercises the real admission path. */
export const UNLIMITED_USAGE_LIMITS: UsageLimits = {
  guestRequestsPerMinute: Number.POSITIVE_INFINITY,
  userRequestsPerMinute: Number.POSITIVE_INFINITY,
  guestRequestsPerDay: Number.POSITIVE_INFINITY,
  userRequestsPerDay: Number.POSITIVE_INFINITY,
  globalRequestsPerDay: Number.POSITIVE_INFINITY,
  guestGlobalRequestsPerDay: Number.POSITIVE_INFINITY,
};

/** Only the variable actually read — see `ProviderEnv` for why not `ProcessEnv`. */
export type UsageLimitsEnv = {
  USAGE_LIMITS?: string | undefined;
  [key: string]: string | undefined;
};

/** `USAGE_LIMITS=off` is how Playwright opts out — dozens of specs from one
 * address would turn any honest cap red, and loosening real numbers to fit tests
 * is tuning the product to them. Integration tests run at production thresholds. */
export function resolveUsageLimits(
  env: UsageLimitsEnv = process.env,
): UsageLimits {
  const configured = env.USAGE_LIMITS?.trim().toLowerCase();

  if (configured === "off") return UNLIMITED_USAGE_LIMITS;
  if (configured === "production") return PRODUCTION_USAGE_LIMITS;

  if (configured) {
    throw new Error(
      `Unknown USAGE_LIMITS "${configured}". Expected "production" or "off".`,
    );
  }

  return PRODUCTION_USAGE_LIMITS;
}
