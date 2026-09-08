import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestRows,
  clearUsageEvents,
  createTestClient,
} from "@/lib/db/test-helpers";

import { SIGN_IN_LINKS_PER_HOUR, admitSignInLink } from "./sign-in-links";

const { client, db } = createTestClient();

const askFor = async (times: number, ipHash: string) => {
  for (let i = 0; i < times; i += 1) await admitSignInLink(ipHash);
};

beforeAll(() => clearUsageEvents(db));
beforeEach(() => clearUsageEvents(db));

afterAll(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
  await client.end();
});

describe("the sign-in link allowance", () => {
  it("lets a reader through who has asked a few times", async () => {
    // The link went to spam twice. That is a person, not a script.
    await askFor(SIGN_IN_LINKS_PER_HOUR - 1, "hash-patient");

    expect(await admitSignInLink("hash-patient")).toBe(true);
  });

  it("stops at the allowance, not one past it", async () => {
    await askFor(SIGN_IN_LINKS_PER_HOUR, "hash-busy");

    expect(await admitSignInLink("hash-busy")).toBe(false);
  });

  it("admits exactly the allowance when the requests arrive together", async () => {
    // The reason counting and recording share a transaction. A script has no
    // reason to await, and two round trips let every caller read the same count
    // and all be admitted against it.
    const admissions = await Promise.all(
      Array.from({ length: SIGN_IN_LINKS_PER_HOUR * 2 }, () =>
        admitSignInLink("hash-concurrent"),
      ),
    );

    expect(admissions.filter(Boolean)).toHaveLength(SIGN_IN_LINKS_PER_HOUR);
  });

  it("counts each caller separately", async () => {
    // Otherwise one script denies sign-in to everybody else.
    await askFor(SIGN_IN_LINKS_PER_HOUR, "hash-noisy");

    expect(await admitSignInLink("hash-quiet")).toBe(true);
  });

  it("does not spend the allowance on a guest asking the demo questions", async () => {
    // Same caller, same `ipHash`, different kind. An unfiltered count would let
    // the demo lock somebody out of signing in.
    const { recordUsage } = await import("./queries");

    for (let i = 0; i < SIGN_IN_LINKS_PER_HOUR + 3; i += 1) {
      await recordUsage({
        actorType: "guest",
        actorId: "guest-1",
        ipHash: "hash-mixed",
        workspaceId: null,
        kind: "chat",
      });
    }

    expect(await admitSignInLink("hash-mixed")).toBe(true);
  });

  it("does not spend the chat allowance, which is the direction that leaked", async () => {
    // The counters read `ip_hash` with no kind filter, so five link rows made a
    // guest's next question their sixth. The chat row is the positive control:
    // unfiltered these return 6, and a broken counter returns 0.
    const { countAllRequestsSince, countRequestsSince, recordUsage } =
      await import("./queries");
    const since = new Date(Date.now() - 60 * 60 * 1000);

    await askFor(SIGN_IN_LINKS_PER_HOUR, "hash-asking");
    await recordUsage({
      actorType: "guest",
      actorId: "guest-2",
      ipHash: "hash-asking",
      workspaceId: null,
      kind: "chat",
    });

    expect(await countRequestsSince({ ipHash: "hash-asking" }, since)).toBe(1);
    expect(await countAllRequestsSince(since)).toBe(1);
  });

  it("forgets a request once the window has passed", async () => {
    // A rolling window heals; a reader locked out at noon is not locked out at
    // two, which is the difference between a rate limit and a ban.
    const { usageEvents } = await import("@/lib/db/schema");
    const { eq, sql } = await import("drizzle-orm");

    await askFor(SIGN_IN_LINKS_PER_HOUR, "hash-yesterday");
    await db
      .update(usageEvents)
      .set({ createdAt: sql`now() - interval '2 hours'` })
      .where(eq(usageEvents.ipHash, "hash-yesterday"));

    expect(await admitSignInLink("hash-yesterday")).toBe(true);
  });

  it("records the hash as the actor, because there is no other identity", async () => {
    const { usageEvents } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await admitSignInLink("hash-recorded");

    const [row] = await db
      .select({
        actorType: usageEvents.actorType,
        actorId: usageEvents.actorId,
        workspaceId: usageEvents.workspaceId,
      })
      .from(usageEvents)
      .where(eq(usageEvents.ipHash, "hash-recorded"));

    expect(row).toEqual({
      actorType: "anonymous",
      actorId: "hash-recorded",
      workspaceId: null,
    });
  });

  it("does not record a request it refused", async () => {
    // Otherwise the window never drains: each refusal extends the lockout.
    const { usageEvents } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await askFor(SIGN_IN_LINKS_PER_HOUR + 3, "hash-refused");

    const rows = await db
      .select({ id: usageEvents.id })
      .from(usageEvents)
      .where(eq(usageEvents.ipHash, "hash-refused"));

    expect(rows).toHaveLength(SIGN_IN_LINKS_PER_HOUR);
  });
});
