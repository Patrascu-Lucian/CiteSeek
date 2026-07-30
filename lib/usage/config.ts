/**
 * The numbers the caps enforce, and where they come from.
 *
 * Resolved from the environment in the same shape as `resolveChatProvider`:
 * unset means the production values, an unknown value throws, and a test harness
 * overrides explicitly. The reasoning is identical — a limiter that quietly
 * defaults to "off" in production is a limiter that is not there, and the
 * failure looks like an exhausted quota rather than a misconfiguration.
 *
 * **The unit is one paid provider call, not one question.** Every row in
 * `usage_events` is one call we were billed a request for: an answered question
 * writes two (embedding, then generation), a refused one writes a single
 * embedding, and an upload writes one per embedding batch. Counting rows
 * therefore counts the thing the free tier actually meters. Counting questions
 * would undercount the refusals, which is precisely the traffic an abuser
 * generates.
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
   * Where guests stop, below the global ceiling.
   *
   * The gap between this and `globalRequestsPerDay` is reserved for signed-in
   * users. The demo is the exposed surface, so a bot hammering it must not be
   * able to take down the owner's own workspace — which matters exactly in the
   * situation the demo exists for: someone evaluating the product while its
   * author is also using it.
   */
  guestGlobalRequestsPerDay: number;
};

/**
 * Provisional, in the same sense the relevance floor is, and for the same
 * reason: they need real traffic to calibrate against.
 *
 * Anchored on the free tier's rough allowance for this model — on the order of
 * 1,000–1,500 requests a day, shared across every key on the project. The global
 * cap sits below that with room left for seeding, manual testing, and the fact
 * that these limits are deliberately soft.
 */
export const PRODUCTION_USAGE_LIMITS: UsageLimits = {
  // ~4 and ~10 questions a minute respectively. Fast for a human reading
  // answers, slow for a script.
  guestRequestsPerMinute: 8,
  userRequestsPerMinute: 20,
  // ~20 and ~100 answered questions a day.
  guestRequestsPerDay: 40,
  userRequestsPerDay: 200,
  globalRequestsPerDay: 800,
  guestGlobalRequestsPerDay: 600,
};

/**
 * Thresholds that cannot be reached.
 *
 * Deliberately not a flag that skips enforcement: with these values the counting
 * queries still run and the decision is still made, so the end-to-end suite
 * exercises the real admission path instead of a branch that steps around it. It
 * proves enforcement does not break the happy path, which is the thing that suite
 * is for.
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
 * `USAGE_LIMITS=off` is how the Playwright suite opts out.
 *
 * 35 specs arrive from one address, against one demo workspace, with retries in
 * CI — any honest per-minute cap turns that suite red, and loosening the real
 * numbers until a test suite fits inside them would be tuning the product to the
 * tests. The harness carries its own configuration instead, which is the rule
 * that fell out of the last environment bug.
 *
 * Integration tests do *not* use this. They run at production thresholds and
 * seed rows to cross them, so what they assert is the behavior of the real
 * numbers rather than of a test-only profile.
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
