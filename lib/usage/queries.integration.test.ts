import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { usageEvents } from "@/lib/db/schema";
import {
  cleanupTestRows,
  clearUsageEvents,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";

import {
  RETENTION_DAYS,
  countRequestsSince,
  pruneUsageEvents,
  recordUsage,
  sumAllTokensSince,
  sumTokensSince,
} from "./queries";

const { client, db } = createTestClient();

/** Shared with the other usage suites — see `clearUsageEvents` for why. */
const clearUsage = () => clearUsageEvents(db);

beforeAll(async () => {
  await cleanupTestRows(db);
  await clearUsage();
});

beforeEach(clearUsage);

afterAll(async () => {
  await clearUsage();
  await cleanupTestRows(db);
  await client.end();
});

const EPOCH = new Date(0);

async function scenario(label = "usage") {
  const user = await createTestUser(db, label);
  const workspace = await createTestWorkspace(db, {
    ownerId: user.id,
    label: `${label}-ws`,
  });

  return { user, workspace };
}

describe("recordUsage", () => {
  it("records what a chat turn cost", async () => {
    const { user, workspace } = await scenario();

    const { recorded } = await recordUsage({
      actorType: "user",
      actorId: user.id,
      ipHash: "hash-a",
      workspaceId: workspace.id,
      kind: "chat",
      inputTokens: 120,
      outputTokens: 40,
    });

    expect(recorded).toBe(true);
    expect(await sumTokensSince({ actorId: user.id }, EPOCH)).toBe(160);
  });

  it("reports failure instead of throwing, and does not pretend it worked", async () => {
    // A request that already succeeded must not become an error because its
    // accounting row did not land. But the caller is told, because usage
    // silently failing to record means every cap silently stops applying.
    const { recorded } = await recordUsage({
      actorType: "user",
      actorId: "not-a-uuid",
      ipHash: null,
      // A workspace that does not exist violates the foreign key.
      workspaceId: "00000000-0000-4000-8000-000000000000",
      kind: "chat",
    });

    expect(recorded).toBe(false);
  });

  it("accepts an event with no workspace", async () => {
    const { recorded } = await recordUsage({
      actorType: "guest",
      actorId: "guest-1",
      ipHash: "hash-b",
      workspaceId: null,
      kind: "embedding",
      inputTokens: 5,
    });

    expect(recorded).toBe(true);
  });
});

describe("counting by actor and by address", () => {
  it("counts a guest's requests by address, not by their id", async () => {
    // The property that makes IP keying worth the complexity: a guest who
    // clears the cookie arrives with a new id and the same address.
    for (const actorId of ["guest-first", "guest-second", "guest-third"]) {
      await recordUsage({
        actorType: "guest",
        actorId,
        ipHash: "same-address",
        workspaceId: null,
        kind: "chat",
      });
    }

    expect(await countRequestsSince({ ipHash: "same-address" }, EPOCH)).toBe(3);
    expect(await countRequestsSince({ actorId: "guest-first" }, EPOCH)).toBe(1);
  });

  it("keeps two addresses in separate buckets", async () => {
    await recordUsage({
      actorType: "guest",
      actorId: "g1",
      ipHash: "address-a",
      workspaceId: null,
      kind: "chat",
    });
    await recordUsage({
      actorType: "guest",
      actorId: "g2",
      ipHash: "address-b",
      workspaceId: null,
      kind: "chat",
    });

    expect(await countRequestsSince({ ipHash: "address-a" }, EPOCH)).toBe(1);
  });

  it("ignores anything older than the window", async () => {
    const { user } = await scenario("windowed");
    await recordUsage({
      actorType: "user",
      actorId: user.id,
      ipHash: null,
      workspaceId: null,
      kind: "chat",
      inputTokens: 99,
    });

    // A window that opens after the row was written must not see it.
    const future = new Date(Date.now() + 60_000);
    expect(await countRequestsSince({ actorId: user.id }, future)).toBe(0);
    expect(await sumTokensSince({ actorId: user.id }, future)).toBe(0);
  });

  it("returns zero rather than null for a caller with no history", async () => {
    // `sum` over an empty set is null in SQL. Returning that raw would make
    // every comparison against a threshold silently false.
    expect(await sumTokensSince({ actorId: "nobody" }, EPOCH)).toBe(0);
    expect(await countRequestsSince({ actorId: "nobody" }, EPOCH)).toBe(0);
  });
});

describe("the global total", () => {
  it("sums across every actor", async () => {
    const a = await scenario("global-a");
    const b = await scenario("global-b");

    await recordUsage({
      actorType: "user",
      actorId: a.user.id,
      ipHash: null,
      workspaceId: a.workspace.id,
      kind: "chat",
      inputTokens: 100,
    });
    await recordUsage({
      actorType: "guest",
      actorId: "guest-x",
      ipHash: "addr",
      workspaceId: b.workspace.id,
      kind: "chat",
      inputTokens: 50,
      outputTokens: 25,
    });

    expect(await sumAllTokensSince(EPOCH)).toBe(175);
    // The per-actor view of the same rows stays separate.
    expect(await sumTokensSince({ actorId: a.user.id }, EPOCH)).toBe(100);
  });
});

describe("retention", () => {
  it("deletes rows past the window and keeps the rest", async () => {
    const { user } = await scenario("retention");

    await recordUsage({
      actorType: "user",
      actorId: user.id,
      ipHash: null,
      workspaceId: null,
      kind: "chat",
      inputTokens: 1,
    });

    // Backdate one row past the window. Written through SQL because the column
    // defaults to now() and there is no application path that sets it.
    await db.insert(usageEvents).values({
      actorType: "user",
      actorId: user.id,
      ipHash: null,
      workspaceId: null,
      kind: "chat",
      inputTokens: 1,
      createdAt: sql`now() - make_interval(days => ${RETENTION_DAYS + 1})`,
    });

    expect(await countRequestsSince({ actorId: user.id }, EPOCH)).toBe(2);

    const removed = await pruneUsageEvents();

    expect(removed).toBe(1);
    // A hashed address kept forever to answer no question is not defensible;
    // one kept for a month answers every cap and the usage dashboard.
    expect(await countRequestsSince({ actorId: user.id }, EPOCH)).toBe(1);
  });

  it("is safe to run when there is nothing to prune", async () => {
    expect(await pruneUsageEvents()).toBe(0);
  });
});
