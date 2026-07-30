import { describe, expect, it } from "vitest";

import {
  PRODUCTION_USAGE_LIMITS,
  UNLIMITED_USAGE_LIMITS,
  resolveUsageLimits,
  type UsageLimits,
} from "./config";
import {
  RATE_WINDOW_SECONDS,
  decideUsage,
  refusalMessage,
  type UsageSnapshot,
} from "./limits";

/**
 * Small round numbers rather than the production ones: these tests are about the
 * rule, and asserting against real thresholds would make every future tuning
 * change look like a behavior change.
 */
const LIMITS: UsageLimits = {
  guestRequestsPerMinute: 3,
  userRequestsPerMinute: 6,
  guestRequestsPerDay: 10,
  userRequestsPerDay: 20,
  globalRequestsPerDay: 100,
  guestGlobalRequestsPerDay: 80,
};

function snapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    actorType: "guest",
    requestsInLastMinute: 0,
    requestsToday: 0,
    globalRequestsToday: 0,
    ...overrides,
  };
}

describe("decideUsage", () => {
  it("admits a caller who has spent nothing", () => {
    expect(decideUsage(snapshot(), LIMITS)).toEqual({ allowed: true });
  });

  it("admits a caller sitting one below every threshold", () => {
    const decision = decideUsage(
      snapshot({
        actorType: "user",
        requestsInLastMinute: 5,
        requestsToday: 19,
        globalRequestsToday: 99,
      }),
      LIMITS,
    );

    expect(decision).toEqual({ allowed: true });
  });

  describe("the burst guard", () => {
    it("refuses a guest at the per-minute ceiling", () => {
      const decision = decideUsage(
        snapshot({ requestsInLastMinute: 3 }),
        LIMITS,
      );

      expect(decision).toEqual({
        allowed: false,
        reason: "rate_limited",
        retryAfterSeconds: RATE_WINDOW_SECONDS,
      });
    });

    it("gives a signed-in user a higher ceiling than a guest", () => {
      const spent = snapshot({ requestsInLastMinute: 4 });

      expect(decideUsage(spent, LIMITS).allowed).toBe(false);
      expect(decideUsage({ ...spent, actorType: "user" }, LIMITS).allowed).toBe(
        true,
      );
    });
  });

  describe("the daily caps", () => {
    it("refuses a guest at their personal daily cap", () => {
      const decision = decideUsage(snapshot({ requestsToday: 10 }), LIMITS);

      expect(decision).toEqual({
        allowed: false,
        reason: "capacity_reached",
        scope: "caller",
      });
    });

    it("refuses everyone once the global cap is reached", () => {
      const decision = decideUsage(
        snapshot({ actorType: "user", globalRequestsToday: 100 }),
        LIMITS,
      );

      expect(decision).toEqual({
        allowed: false,
        reason: "capacity_reached",
        scope: "global",
      });
    });
  });

  describe("the reserve for signed-in users", () => {
    /**
     * The property the reserve exists for: a bot on the public demo must not be
     * able to take the owner's own workspace down. Same global usage, two
     * different answers.
     */
    it("stops a guest while a signed-in user keeps working", () => {
      const global = snapshot({ globalRequestsToday: 85 });

      expect(decideUsage(global, LIMITS)).toEqual({
        allowed: false,
        reason: "capacity_reached",
        scope: "global",
      });
      expect(decideUsage({ ...global, actorType: "user" }, LIMITS)).toEqual({
        allowed: true,
      });
    });

    it("stops a signed-in user too, once the global cap itself is reached", () => {
      const decision = decideUsage(
        snapshot({ actorType: "user", globalRequestsToday: 100 }),
        LIMITS,
      );

      expect(decision.allowed).toBe(false);
    });
  });

  describe("which refusal wins", () => {
    /**
     * A caller who is both out of daily quota and going too fast must not be
     * told to retry in a minute — the daily window will not have moved, so that
     * answer is simply false.
     */
    it("reports capacity rather than rate when both apply", () => {
      const decision = decideUsage(
        snapshot({ requestsInLastMinute: 99, requestsToday: 10 }),
        LIMITS,
      );

      expect(decision).toEqual({
        allowed: false,
        reason: "capacity_reached",
        scope: "caller",
      });
    });

    it("reports the global cap ahead of the caller's own", () => {
      const decision = decideUsage(
        snapshot({ requestsToday: 10, globalRequestsToday: 100 }),
        LIMITS,
      );

      expect(decision).toMatchObject({ scope: "global" });
    });
  });

  it("says nothing about numbers in either message", () => {
    // Thresholds are provisional; a message quoting one goes stale the first
    // time it is tuned, and nobody re-reads copy when changing a constant.
    expect(refusalMessage("rate_limited")).not.toMatch(/\d/);
    expect(refusalMessage("capacity_reached")).toMatch(/capacity/i);
  });
});

describe("resolveUsageLimits", () => {
  it("enforces production values when unset", () => {
    expect(resolveUsageLimits({})).toBe(PRODUCTION_USAGE_LIMITS);
  });

  it("accepts an explicit production", () => {
    expect(resolveUsageLimits({ USAGE_LIMITS: "Production " })).toBe(
      PRODUCTION_USAGE_LIMITS,
    );
  });

  it("lifts every threshold on off", () => {
    expect(resolveUsageLimits({ USAGE_LIMITS: "off" })).toBe(
      UNLIMITED_USAGE_LIMITS,
    );
  });

  it("throws on a value it does not recognize", () => {
    // The failure mode this prevents: a typo silently resolving to "no limits",
    // which looks exactly like a working deploy until the quota is gone.
    expect(() => resolveUsageLimits({ USAGE_LIMITS: "disabled" })).toThrow(
      /Unknown USAGE_LIMITS/,
    );
  });

  it("admits everything under the unlimited profile", () => {
    const busy = snapshot({
      requestsInLastMinute: 10_000,
      requestsToday: 10_000,
      globalRequestsToday: 10_000,
    });

    expect(decideUsage(busy, UNLIMITED_USAGE_LIMITS)).toEqual({
      allowed: true,
    });
  });
});
