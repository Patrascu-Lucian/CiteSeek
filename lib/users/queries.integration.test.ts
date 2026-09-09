import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { accounts, users, workspaces } from "@/lib/db/schema";
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

  it("returns them in the order the provider list sets, not alphabetically", async () => {
    // Rendered as a sentence on the account page, so unordered rows reorder
    // between loads and read as a bug. Alphabetical was the old rule and is
    // indistinguishable from this one whenever the two happen to agree — they
    // disagree here, which is what makes the assertion worth making.
    // Linked in the opposite order to the one expected, so the sort is the only
    // thing that can produce this — insertion order would pass without it.
    const user = await createTestUser(db);
    await link(user.id, "github");
    await link(user.id, "google");

    expect(await listSignInMethods(user.id)).toEqual([
      { provider: "google" },
      { provider: "github" },
    ]);
  });

  it("orders a provider it no longer configures, rather than leaving it to Postgres", async () => {
    // Everything outside `AUTH_PROVIDERS` ranks equal, and dropping the SQL
    // `order by` left those rows in whatever order the database returned. Not
    // reachable while both live providers are listed; reachable the day one is
    // retired and readers still hold rows for it.
    const user = await createTestUser(db);
    await link(user.id, "zzz-retired");
    await link(user.id, "aaa-retired");
    await link(user.id, "github");

    expect(await listSignInMethods(user.id)).toEqual([
      { provider: "github" },
      { provider: "aaa-retired" },
      { provider: "zzz-retired" },
    ]);
  });

  it("puts the email link after every provider, wherever it sorts", async () => {
    // It is not in `AUTH_PROVIDERS` and must not be — nothing signs in "with
    // email" through `signIn(id)` — so it has no index to rank by.
    const user = await createTestUser(db);
    await link(user.id, "github");
    await link(user.id, "google");
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, user.id));

    expect(await listSignInMethods(user.id)).toEqual([
      { provider: "google" },
      { provider: "github" },
      { provider: "email" },
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

  it("counts a verified email as a method, though it has no accounts row", async () => {
    // Magic link never calls `linkAccount`, so an email-only reader would show
    // "Signs in with —" and be offered both providers to add.
    const user = await createTestUser(db);
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, user.id));

    expect(await listSignInMethods(user.id)).toEqual([{ provider: "email" }]);
  });

  it("does not count an unverified email, which is what OAuth leaves", async () => {
    // `handle-login` :260 creates an OAuth user with `emailVerified: null`, so a
    // date here means somebody proved they hold the inbox — not that a provider
    // said the address was theirs.
    const user = await createTestUser(db);
    await link(user.id, "github");

    expect(await listSignInMethods(user.id)).toEqual([{ provider: "github" }]);
  });

  it("shows both when a reader has linked a provider and used a link", async () => {
    const user = await createTestUser(db);
    await link(user.id, "google");
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, user.id));

    expect(await listSignInMethods(user.id)).toEqual([
      { provider: "google" },
      { provider: "email" },
    ]);
  });

  it("does not leak another user's providers", async () => {
    const mine = await createTestUser(db, "mine");
    const theirs = await createTestUser(db, "theirs");
    await link(mine.id, "github");
    await link(theirs.id, "google");

    expect(await listSignInMethods(mine.id)).toEqual([{ provider: "github" }]);
  });
});
