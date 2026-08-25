import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAN_LIMITS,
  UNLIMITED_PLAN_LIMITS,
  resolvePlanLimits,
} from "./config";
import { MAX_REQUEST_MESSAGES } from "@/lib/ai/request-bounds";

import {
  type CapReached,
  capRefusalBody,
  capRefusalCopy,
  capRefusalMessage,
  decideCap,
  parseCapRefusal,
  storageExceededMessage,
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

describe("capRefusalCopy — conversations", () => {
  const decision = reached({ cap: "conversations" });

  it("names the limit and points at the list below it", () => {
    expect(capRefusalCopy(decision)).toEqual({
      title: "You have reached the limit of 3 conversations.",
      detail: "Delete one below to start another.",
    });
  });

  it("joins into the same sentence an HTTP body would carry", () => {
    const { title, detail } = capRefusalCopy(decision);
    expect(capRefusalMessage(decision)).toBe(`${title} ${detail}`);
  });
});

// Not a style rule. `getOrCreateChat` inserts when a reader has none, on the
// chat-*turn* path, so at zero it would either exceed a cap of 0 or swallow the
// question. Every value >= 1 is safe: that path never inserts a second.
describe("the conversations limit", () => {
  it("is at least one, which is what makes the implicit path safe", () => {
    expect(DEFAULT_PLAN_LIMITS.conversations).toBeGreaterThanOrEqual(1);
  });
});

describe("capRefusalCopy — messages", () => {
  const decision = reached({ cap: "messages", limit: 60, current: 60 });

  it("offers both moves that work when a conversation is still available", () => {
    // Deleting an exchange became a real move in ADR 042. Naming what to delete
    // is what ADR 039 asks of a stock limit, and this one could not until then.
    const { detail } = capRefusalCopy(decision);

    expect(detail).toContain("Delete an exchange");
    expect(detail).toContain("start a new conversation");
  });

  it("offers the other conversations before it offers deleting one", () => {
    // The first version sent a reader to delete something they did not have to.
    const copy = capRefusalCopy(decision, { conversationsExhausted: true });

    expect(copy.detail).toMatch(/one of your other conversations/i);
    expect(copy.detail).toContain("delete an exchange");
    expect(copy.detail).not.toContain("start a new conversation");
  });
});

describe("the saved-message limit against the transcript guard", () => {
  it("leaves room for the turn that would be added", () => {
    expect(DEFAULT_PLAN_LIMITS.messagesPerConversation).toBeLessThan(
      MAX_REQUEST_MESSAGES - 2,
    );
  });
});

describe("capRefusalCopy — storage", () => {
  const decision = reached({
    cap: "storage",
    limit: 500_000,
    current: 500_000,
  });

  it("groups the number so a reader can read it", () => {
    expect(capRefusalCopy(decision).title).toContain("500,000");
  });

  // Same rule, different moment: not over yet, but this document would cross it.
  it("says something different at ingestion than at upload", () => {
    expect(storageExceededMessage(500_000)).toContain("500,000");
    expect(storageExceededMessage(500_000)).not.toBe(
      capRefusalMessage(decision),
    );
  });
});

describe("parseCapRefusal", () => {
  const body = capRefusalBody(reached({ cap: "messages", limit: 60 }));

  it("reads a cap refusal off the transport's error", () => {
    expect(parseCapRefusal(new Error(JSON.stringify(body)))).toEqual(body);
  });

  it("ignores a rate-limit refusal", () => {
    const rateLimited = JSON.stringify({
      error: "Too many requests.",
      code: "rate_limited",
    });

    expect(parseCapRefusal(new Error(rateLimited))).toBeNull();
  });

  it("ignores an HTML error page rather than misreporting it", () => {
    expect(parseCapRefusal(new Error("<html>502</html>"))).toBeNull();
  });

  it("rejects a cap body with no copy in it", () => {
    const partial = JSON.stringify({ code: "cap_reached", cap: "messages" });

    expect(parseCapRefusal(new Error(partial))).toBeNull();
  });
});

describe("capRefusalBody", () => {
  it("carries the decision the client would otherwise re-derive", () => {
    const decision = reached({ current: 4 });
    const context = { failedDocuments: 1 };

    const copy = capRefusalCopy(decision, context);

    expect(capRefusalBody(decision, context)).toEqual({
      ...copy,
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
