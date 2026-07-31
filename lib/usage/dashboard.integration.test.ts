import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { usageEvents } from "@/lib/db/schema";
import {
  cleanupTestRows,
  clearUsageEvents,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";

import { workspaceUsage } from "./dashboard";
import { RETENTION_DAYS } from "./queries";

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

async function workspace(label: string) {
  const user = await createTestUser(db, label);
  return createTestWorkspace(db, { ownerId: user.id, label: `${label}-ws` });
}

async function record(
  workspaceId: string,
  createdAt: Date,
  tokens: { input: number; output: number } = { input: 10, output: 20 },
) {
  await db.insert(usageEvents).values({
    actorType: "user",
    actorId: "actor",
    ipHash: null,
    workspaceId,
    kind: "chat",
    requests: 1,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    createdAt,
  });
}

/** A UTC instant on a named day, so the grouping assertions are unambiguous. */
function utc(day: string, hour = 12) {
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

/** Days ago, which is how the retention window is expressed. */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe("workspaceUsage", () => {
  it("reports an empty workspace honestly rather than as an error", async () => {
    // The common case for a new account, not an edge case.
    const ws = await workspace("usage-empty");

    const usage = await workspaceUsage(ws.id);

    expect(usage.days).toEqual([]);
    expect(usage.totals).toEqual({
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(usage.lastRecordedAt).toBeNull();
    expect(usage.windowDays).toBe(RETENTION_DAYS);
  });

  it("groups by UTC day and totals the tokens in each", async () => {
    const ws = await workspace("usage-group");
    await record(ws.id, daysAgo(1), { input: 5, output: 7 });
    await record(ws.id, daysAgo(1), { input: 1, output: 2 });
    await record(ws.id, daysAgo(2), { input: 100, output: 200 });

    const usage = await workspaceUsage(ws.id);

    expect(usage.days).toHaveLength(2);
    // Newest first, which is the order the page reads in.
    expect(usage.days[0]).toMatchObject({
      requests: 2,
      inputTokens: 6,
      outputTokens: 9,
    });
    expect(usage.days[1]).toMatchObject({
      requests: 1,
      inputTokens: 100,
      outputTokens: 200,
    });
    expect(usage.totals).toEqual({
      requests: 3,
      inputTokens: 106,
      outputTokens: 209,
    });
  });

  it("splits events either side of midnight UTC into separate days", async () => {
    // The boundary the interface has to be honest about: a reader in Europe sees
    // an evening's questions counted against the next day for part of the year.
    const ws = await workspace("usage-boundary");
    const today = new Date();
    const base = today.toISOString().slice(0, 10);
    await record(ws.id, utc(base, 23));
    await record(ws.id, new Date(utc(base, 23).getTime() + 2 * 60 * 60 * 1000));

    const usage = await workspaceUsage(ws.id);

    // 23:00 and 01:00 the next day are two calendar days, not one session.
    expect(usage.days).toHaveLength(2);
    expect(usage.days.map((d) => d.requests)).toEqual([1, 1]);
  });

  it("ignores events older than the retention window", async () => {
    // A longer range would report zeroes for days whose rows were pruned, which
    // reads as a quiet month rather than an absent one.
    const ws = await workspace("usage-window");
    await record(ws.id, daysAgo(RETENTION_DAYS + 2));
    await record(ws.id, daysAgo(1));

    const usage = await workspaceUsage(ws.id);

    expect(usage.days).toHaveLength(1);
    expect(usage.totals.requests).toBe(1);
  });

  /**
   * The property that makes this a workspace question rather than an actor one.
   * Limit reads deliberately span every workspace; this must not.
   */
  it("never counts another workspace's usage", async () => {
    const mine = await workspace("usage-mine");
    const theirs = await workspace("usage-theirs");
    await record(mine.id, daysAgo(1));
    await record(theirs.id, daysAgo(1));
    await record(theirs.id, daysAgo(1));

    expect((await workspaceUsage(mine.id)).totals.requests).toBe(1);
    expect((await workspaceUsage(theirs.id)).totals.requests).toBe(2);
  });

  it("reports when usage was last recorded", async () => {
    // The visible half of the `{ recorded }` signal nothing consumed: a date
    // that stops moving while the app is in use is the only sign that recording
    // has failed, because that failure is swallowed on the chat path by design.
    const ws = await workspace("usage-last");
    const recent = daysAgo(1);
    await record(ws.id, daysAgo(5));
    await record(ws.id, recent);

    const usage = await workspaceUsage(ws.id);

    expect(usage.lastRecordedAt).not.toBeNull();
    expect(usage.lastRecordedAt!.getTime()).toBeCloseTo(recent.getTime(), -3);
  });

  it("reports a last-recorded time even for an event outside the window", async () => {
    // Otherwise a workspace that stopped being used a month ago would look
    // identical to one where recording broke, which is the distinction this
    // field exists to make.
    const ws = await workspace("usage-last-old");
    await record(ws.id, daysAgo(RETENTION_DAYS + 5));

    const usage = await workspaceUsage(ws.id);

    expect(usage.days).toEqual([]);
    expect(usage.lastRecordedAt).not.toBeNull();
  });
});
