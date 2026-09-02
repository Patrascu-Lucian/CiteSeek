import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, workspaces } from "@/lib/db/schema";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
} from "@/lib/db/test-helpers";
import { getOrCreatePersonalWorkspace } from "@/lib/workspaces/personal";

import { listSignInMethods } from "./queries";

const { client, db } = createTestClient();

const link = (userId: string, provider: string) =>
  db.insert(accounts).values({
    userId,
    provider,
    providerAccountId: `${provider}-1`,
    type: "oauth",
  });

beforeAll(() => cleanupTestRows(db));
beforeEach(() => cleanupTestRows(db));

afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

describe("a user with two providers", () => {
  it("holds both on one account, with no schema change", async () => {
    // `accounts` is keyed on (provider, provider_account_id), so one user row
    // already carries many providers — the block on linking is Auth.js policy,
    // not the database (ADR 051).
    const user = await createTestUser(db);
    await link(user.id, "github");
    await link(user.id, "google");

    const methods = await listSignInMethods(user.id);

    expect(methods.map((one) => one.provider).sort()).toEqual([
      "github",
      "google",
    ]);
  });

  it("keeps one workspace, because linking is not a new account", async () => {
    // What the design rests on: Auth.js returns before `events.createUser` when
    // it links, so no second workspace is provisioned. The event is idempotent
    // as a backstop, and this pins the backstop.
    const user = await createTestUser(db);
    await link(user.id, "github");
    await getOrCreatePersonalWorkspace({ id: user.id, name: null });

    await link(user.id, "google");
    await getOrCreatePersonalWorkspace({ id: user.id, name: null });

    const owned = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.id));

    expect(owned).toHaveLength(1);
  });

  it("does not leak another user's providers", async () => {
    const mine = await createTestUser(db, "mine");
    const theirs = await createTestUser(db, "theirs");
    await link(mine.id, "github");
    await link(theirs.id, "google");

    expect(await listSignInMethods(mine.id)).toEqual([{ provider: "github" }]);
  });
});
