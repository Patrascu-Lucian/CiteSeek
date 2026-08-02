/**
 * The numbers the caps enforce.
 *
 * Unset means production values, an unknown value throws — a limiter that
 * quietly defaults to "off" in production is a limiter that is not there, and
 * the failure looks like an exhausted quota rather than a misconfiguration.
 *
 * **The unit is one paid provider call, not one question.** An answered question
 * writes two rows (embedding, then generation), a refused one writes a single
 * embedding, an upload writes one per batch. Counting questions would undercount
 * refusals, which is precisely the traffic an abuser generates.
 *
 * See `docs/decisions/014-usage-limiting.md`.
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
  /**
   * Where guests stop, below the global ceiling. The gap is reserved for
   * signed-in users, so a bot hammering the demo cannot take down the owner's
   * own workspace — which matters exactly when someone is evaluating the product
   * while its author is using it.
   */
  guestGlobalRequestsPerDay: number;
};

/**
 * Provisional; they need real traffic to calibrate against. Anchored on the free
 * tier's rough allowance for this model — order of 1,000–1,500 requests a day,
 * shared across every key on the project — with room left for seeding and
 * manual testing.
 */
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

/**
 * Thresholds that cannot be reached — deliberately not a flag that skips
 * enforcement. The counting queries still run and the decision is still made, so
 * the E2E suite exercises the real admission path rather than a branch around it.
 */
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

/**
 * `USAGE_LIMITS=off` is how the Playwright suite opts out: dozens of specs from
 * one address with retries in CI would turn any honest per-minute cap red, and
 * loosening the real numbers to fit a test suite is tuning the product to its
 * tests.
 *
 * Integration tests do *not* use this — they run at production thresholds and
 * seed rows to cross them.
 */
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
