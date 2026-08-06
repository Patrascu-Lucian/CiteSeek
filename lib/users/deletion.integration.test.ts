import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { usageEvents, users } from "@/lib/db/schema";
import {
  cleanupTestRows,
  clearUsageEvents,
  createTestClient,
  createTestUser,
} from "@/lib/db/test-helpers";

import { deleteUserAccount } from "./deletion";

const { client, db } = createTestClient();

beforeAll(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
});

beforeEach(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
});

afterAll(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
  await client.end();
});

describe("deleteUserAccount", () => {
  it("takes the usage records with it", async () => {
    // No cascade reaches `usage_events` — a deleted account kept its rows in
    // production while the privacy page promised otherwise.
    const { id: userId } = await createTestUser(db);

    await db.insert(usageEvents).values({
      actorType: "user",
      actorId: userId,
      kind: "chat",
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(await deleteUserAccount(userId)).toBe(true);

    const remaining = await db
      .select({ id: usageEvents.id })
      .from(usageEvents)
      .where(eq(usageEvents.actorId, userId));

    expect(remaining).toEqual([]);
    expect(
      await db.select({ id: users.id }).from(users).where(eq(users.id, userId)),
    ).toEqual([]);
  });

  it("leaves another account's usage alone", async () => {
    // One statement scoped by actor, not a truncate — the rate limiter reads
    // these rows for everyone.
    const mine = (await createTestUser(db)).id;
    const theirs = (await createTestUser(db)).id;

    await db.insert(usageEvents).values([
      { actorType: "user", actorId: mine, kind: "chat", inputTokens: 1 },
      { actorType: "user", actorId: theirs, kind: "chat", inputTokens: 1 },
    ]);

    await deleteUserAccount(mine);

    expect(
      await db
        .select({ id: usageEvents.id })
        .from(usageEvents)
        .where(eq(usageEvents.actorId, theirs)),
    ).toHaveLength(1);
  });
});
