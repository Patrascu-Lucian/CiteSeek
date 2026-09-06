import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestRows,
  clearUsageEvents,
  createTestClient,
} from "@/lib/db/test-helpers";

import {
  SIGN_IN_LINKS_PER_HOUR,
  recordSignInLink,
  signInLinksExhausted,
} from "./sign-in-links";

const { client, db } = createTestClient();

const askFor = async (times: number, ipHash: string) => {
  for (let i = 0; i < times; i += 1) await recordSignInLink(ipHash);
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

    expect(await signInLinksExhausted("hash-patient")).toBe(false);
  });

  it("stops at the allowance, not one past it", async () => {
    await askFor(SIGN_IN_LINKS_PER_HOUR, "hash-busy");

    expect(await signInLinksExhausted("hash-busy")).toBe(true);
  });

  it("counts each caller separately", async () => {
    // Otherwise one script denies sign-in to everybody else.
    await askFor(SIGN_IN_LINKS_PER_HOUR, "hash-noisy");

    expect(await signInLinksExhausted("hash-quiet")).toBe(false);
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

    expect(await signInLinksExhausted("hash-mixed")).toBe(false);
  });

  it("forgets a request once the window has passed", async () => {
    // A rolling window heals; a reader locked out at noon is not locked out at
    // two, which is the difference between a rate limit and a ban.
    const { usageEvents } = await import("@/lib/db/schema");
    const { sql } = await import("drizzle-orm");

    await askFor(SIGN_IN_LINKS_PER_HOUR, "hash-yesterday");
    await db
      .update(usageEvents)
      .set({ createdAt: sql`now() - interval '2 hours'` });

    expect(await signInLinksExhausted("hash-yesterday")).toBe(false);
  });

  it("records the hash as the actor, because there is no other identity", async () => {
    const { usageEvents } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await recordSignInLink("hash-recorded");

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
});
