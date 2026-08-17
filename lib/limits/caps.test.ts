import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAN_LIMITS,
  UNLIMITED_PLAN_LIMITS,
  resolvePlanLimits,
} from "./config";
import {
  type CapReached,
  capRefusalBody,
  capRefusalMessage,
  decideCap,
} from "./caps";

/** A small round number rather than the shipped one: these tests are about the
 * rule, and asserting against the real threshold would make every future tuning
 * change look like a behavior change. */
const LIMIT = 3;

function reached(overrides: Partial<CapReached> = {}): CapReached {
  return {
    allowed: false,
    reason: "cap_reached",
    cap: "documents",
    limit: LIMIT,
    current: LIMIT,
    ...overrides,
  };
}

describe("decideCap", () => {
  it("admits a workspace holding nothing", () => {
    expect(decideCap("documents", 0, LIMIT)).toEqual({ allowed: true });
  });

  it("admits the upload that fills the last slot", () => {
    expect(decideCap("documents", LIMIT - 1, LIMIT)).toEqual({ allowed: true });
  });

  it("refuses at the cap, carrying both numbers", () => {
    expect(decideCap("documents", LIMIT, LIMIT)).toEqual({
      allowed: false,
      reason: "cap_reached",
      cap: "documents",
      limit: LIMIT,
      current: LIMIT,
    });
  });

  /* The race in `decideCap`'s own note: two concurrent uploads can both pass at
     `limit - 1`, so the count is over the cap by the time the next one asks. `>`
     would admit forever from there. */
  it("keeps refusing once a race has overshot the cap", () => {
    expect(decideCap("documents", LIMIT + 1, LIMIT)).toMatchObject({
      allowed: false,
      current: LIMIT + 1,
    });
  });

  it("admits everything under the unlimited thresholds", () => {
    expect(
      decideCap("documents", 10_000, UNLIMITED_PLAN_LIMITS.documents),
    ).toEqual({ allowed: true });
  });
});

describe("capRefusalMessage", () => {
  it("names the limit and what to do about it", () => {
    expect(capRefusalMessage(reached())).toBe(
      "You have reached the limit of 3 documents. Delete one to upload another.",
    );
  });

  /* The case the cap would otherwise strand: three failed parses sit at the cap
     with nothing usable, and "delete one" would point at a working document. */
  it("points at the failed document when one is at fault", () => {
    expect(capRefusalMessage(reached(), { failedDocuments: 1 })).toContain(
      "One of them failed to process",
    );
  });

  it("counts them when more than one failed", () => {
    expect(capRefusalMessage(reached(), { failedDocuments: 2 })).toContain(
      "2 of them failed to process",
    );
  });

  it("states the limit that was actually configured", () => {
    expect(capRefusalMessage(reached({ limit: 10 }))).toContain(
      "limit of 10 documents",
    );
  });
});

describe("capRefusalBody", () => {
  it("carries the decision the client would otherwise re-derive", () => {
    const decision = reached({ current: 4 });
    const context = { failedDocuments: 1 };

    expect(capRefusalBody(decision, context)).toEqual({
      error: capRefusalMessage(decision, context),
      code: "cap_reached",
      cap: "documents",
      limit: LIMIT,
      current: 4,
    });
  });
});

describe("resolvePlanLimits", () => {
  it("defaults to the shipped limits when nothing is set", () => {
    expect(resolvePlanLimits({})).toEqual(DEFAULT_PLAN_LIMITS);
  });

  it("reads `off` as unreachable thresholds rather than a skipped check", () => {
    expect(resolvePlanLimits({ PLAN_LIMITS: "off" })).toEqual(
      UNLIMITED_PLAN_LIMITS,
    );
  });

  it("accepts the explicit default, whatever its casing", () => {
    expect(resolvePlanLimits({ PLAN_LIMITS: " DEFAULT " })).toEqual(
      DEFAULT_PLAN_LIMITS,
    );
  });

  /* Throwing rather than falling back: a limiter that defaults to "off" on a
     typo is a limiter that is not there, and the failure is invisible. */
  it("throws on a value it does not recognize", () => {
    expect(() => resolvePlanLimits({ PLAN_LIMITS: "none" })).toThrow(
      /Unknown PLAN_LIMITS/,
    );
  });
});
