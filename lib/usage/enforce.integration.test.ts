import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { usageEvents } from "@/lib/db/schema";
import {
  clearUsageEvents,
  cleanupTestRows,
  createTestClient,
} from "@/lib/db/test-helpers";

import { hashClientIp } from "./client-ip";
import { PRODUCTION_USAGE_LIMITS as LIMITS } from "./config";
import { enforceUsageLimits, type UsageRefusalBody } from "./enforce";

/**
 * Admission control against a real database at the **production** thresholds — a
 * suite that invents its own proves only that the arithmetic works. Rows are
 * seeded in bulk to cross a cap.
 *
 * Directly rather than through a route: a guest needs the demo workspace, and a
 * partial unique index allows exactly one of those to exist.
 */

const { client, db } = createTestClient();

beforeAll(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
});

beforeEach(() => clearUsageEvents(db));

afterAll(async () => {
  await clearUsageEvents(db);
  await cleanupTestRows(db);
  await client.end();
});

/** The address the tests arrive from, and the hash it reduces to. */
const ADDRESS = "203.0.113.9";
const ADDRESS_HASH = hashClientIp(ADDRESS);
const OTHER_HASH = hashClientIp("198.51.100.4");

const GUEST = { actorType: "guest", actorId: "guest-session-1" } as const;
const USER = { actorType: "user", actorId: "user-1" } as const;

/** Production thresholds, stated explicitly rather than read from the ambient env. */
const PRODUCTION = { USAGE_LIMITS: "production" };

/**
 * Writes `count` metered calls attributed to a caller.
 *
 * One statement rather than `count` calls to `recordUsage`: crossing a daily cap
 * means hundreds of rows, and the point of the test is the decision, not the
 * insert path — which `queries.integration.test.ts` already covers.
 */
async function seedUsage(
  attribution: { ipHash?: string; actorId?: string },
  count: number,
  createdAt?: Date,
) {
  if (count === 0) return;

  await db.insert(usageEvents).values(
    Array.from({ length: count }, () => ({
      actorType: "guest" as const,
      actorId: attribution.actorId ?? "seeded",
      ipHash: attribution.ipHash ?? null,
      workspaceId: null,
      kind: "chat" as const,
      requests: 1,
      inputTokens: 0,
      outputTokens: 0,
      ...(createdAt ? { createdAt } : {}),
    })),
  );
}

async function refusalOf(response: Response): Promise<UsageRefusalBody> {
  return (await response.json()) as UsageRefusalBody;
}

describe("enforceUsageLimits", () => {
  it("admits a caller who has spent nothing", async () => {
    const refused = await enforceUsageLimits(GUEST, ADDRESS_HASH, PRODUCTION);

    expect(refused).toBeNull();
  });

  it("rate-limits a guest who bursts, and says when to come back", async () => {
    await seedUsage({ ipHash: ADDRESS_HASH }, LIMITS.guestRequestsPerMinute);

    const refused = await enforceUsageLimits(GUEST, ADDRESS_HASH, PRODUCTION);

    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Retry-After")).toBe("60");
    expect(await refusalOf(refused!)).toMatchObject({ code: "rate_limited" });
  });

  it("reports capacity, not a retry, once the daily cap is spent", async () => {
    // An hour back, so the rolling minute window is empty and only the daily cap
    // can be what refuses this.
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await seedUsage(
      { ipHash: ADDRESS_HASH },
      LIMITS.guestRequestsPerDay,
      anHourAgo,
    );

    const refused = await enforceUsageLimits(GUEST, ADDRESS_HASH, PRODUCTION);

    expect(refused?.status).toBe(429);
    // No retry offered: the daily window will not have moved in a minute, so
    // suggesting one would be false.
    expect(refused?.headers.get("Retry-After")).toBeNull();
    expect(await refusalOf(refused!)).toMatchObject({
      code: "capacity_reached",
    });
  });

  /**
   * The property that justifies keying guests on their address at all. A guest
   * id is self-assigned — `/demo` mints a fresh signed cookie on every visit —
   * so a limit that counted it would be escaped by clearing a cookie.
   */
  it("keeps limiting a guest who throws their cookie away", async () => {
    await seedUsage({ ipHash: ADDRESS_HASH }, LIMITS.guestRequestsPerMinute);

    const withANewIdentity = {
      actorType: "guest",
      actorId: "a-brand-new-session",
    } as const;

    const refused = await enforceUsageLimits(
      withANewIdentity,
      ADDRESS_HASH,
      PRODUCTION,
    );

    expect(refused?.status).toBe(429);
  });

  it("does not limit a different address", async () => {
    await seedUsage({ ipHash: ADDRESS_HASH }, LIMITS.guestRequestsPerMinute);

    expect(await enforceUsageLimits(GUEST, OTHER_HASH, PRODUCTION)).toBeNull();
  });

  it("counts a signed-in user by their id, not their address", async () => {
    // Enough from this address to stop a guest several times over, all of it
    // attributed to nobody in particular.
    await seedUsage({ ipHash: ADDRESS_HASH }, LIMITS.guestRequestsPerMinute);

    expect(await enforceUsageLimits(USER, ADDRESS_HASH, PRODUCTION)).toBeNull();
  });

  describe("the reserve", () => {
    /**
     * The scenario the reserve exists for: a bot on the public demo must not be
     * able to take down the owner's own workspace mid-demonstration.
     */
    it("stops guests at the reserve while a signed-in user keeps working", async () => {
      const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      await seedUsage(
        { ipHash: OTHER_HASH },
        LIMITS.guestGlobalRequestsPerDay,
        anHourAgo,
      );

      const guest = await enforceUsageLimits(GUEST, ADDRESS_HASH, PRODUCTION);
      expect(guest?.status).toBe(429);
      expect(await refusalOf(guest!)).toMatchObject({
        code: "capacity_reached",
      });

      expect(
        await enforceUsageLimits(USER, ADDRESS_HASH, PRODUCTION),
      ).toBeNull();
    });

    it("stops signed-in users too once the global cap is reached", async () => {
      const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      await seedUsage(
        { ipHash: OTHER_HASH },
        LIMITS.globalRequestsPerDay,
        anHourAgo,
      );

      const refused = await enforceUsageLimits(USER, ADDRESS_HASH, PRODUCTION);

      expect(refused?.status).toBe(429);
    });
  });

  it("ignores usage older than the window", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await seedUsage(
      { ipHash: ADDRESS_HASH },
      LIMITS.globalRequestsPerDay,
      twoDaysAgo,
    );

    expect(
      await enforceUsageLimits(GUEST, ADDRESS_HASH, PRODUCTION),
    ).toBeNull();
  });

  it("lifts every cap under the off profile", async () => {
    await seedUsage({ ipHash: ADDRESS_HASH }, LIMITS.globalRequestsPerDay);

    // What the Playwright harness runs with. The counting queries still execute;
    // only the thresholds change.
    expect(
      await enforceUsageLimits(GUEST, ADDRESS_HASH, { USAGE_LIMITS: "off" }),
    ).toBeNull();
  });
});
