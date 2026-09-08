import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { usageEvents, users, verificationTokens } from "@/lib/db/schema";
import {
  cleanupTestRows,
  clearUsageEvents,
  clearVerificationTokens,
  createTestClient,
  createTestUser,
} from "@/lib/db/test-helpers";

import { deleteUserAccount } from "./deletion";

const { client, db } = createTestClient();

beforeAll(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
  await clearVerificationTokens(db);
});

beforeEach(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
  await clearVerificationTokens(db);
});

afterAll(async () => {
  await cleanupTestRows(db);
  await clearUsageEvents(db);
  await clearVerificationTokens(db);
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
describe("deleteUserAccount and the sign-in tokens", () => {
  const link = (identifier: string) =>
    db.insert(verificationTokens).values({
      identifier,
      token: `tok-${crypto.randomUUID()}`,
      expires: new Date(Date.now() + 600_000),
    });

  const tokensFor = (identifier: string) =>
    db
      .select({ token: verificationTokens.token })
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier));

  it("takes the unspent links with it", async () => {
    // No foreign key reaches this table — the identifier is an address, because
    // no user exists when the first link is asked for. So nothing cascades, and
    // the privacy page promises deletion removes everything.
    const user = await createTestUser(db);
    const email = `erase-${user.id}@example.test`;
    await db.update(users).set({ email }).where(eq(users.id, user.id));
    await link(email);

    await deleteUserAccount(user.id);

    expect(await tokensFor(email)).toEqual([]);
  });

  it("matches an identifier that differs in case from the stored address", async () => {
    // Auth.js lowercases an identifier before storing it; an OAuth profile
    // supplies `users.email` untouched. Anyone who used GitHub before a link
    // has the two in different cases, and an exact match would leave a live
    // credential behind after erasure.
    const user = await createTestUser(db);
    const stored = `Erase-Mixed-${user.id}@Example.test`;
    await db.update(users).set({ email: stored }).where(eq(users.id, user.id));
    await link(stored.toLowerCase());

    await deleteUserAccount(user.id);

    expect(await tokensFor(stored.toLowerCase())).toEqual([]);
  });

  it("leaves another address's links alone", async () => {
    const mine = await createTestUser(db, "mine");
    const email = `erase-mine-${mine.id}@example.test`;
    const theirs = `erase-theirs-${mine.id}@example.test`;
    await db.update(users).set({ email }).where(eq(users.id, mine.id));
    await link(email);
    await link(theirs);

    await deleteUserAccount(mine.id);

    expect(await tokensFor(theirs)).toHaveLength(1);
    // Cleanup is `clearVerificationTokens` in `beforeEach`, not a last line here:
    // a failing assertion above would have leaked the row.
  });

  it("still deletes an account whose provider withheld an address", async () => {
    // GitHub can. `users.email` is nullable, and erasure must not depend on it.
    const user = await createTestUser(db);

    expect(await deleteUserAccount(user.id)).toBe(true);
  });
});
