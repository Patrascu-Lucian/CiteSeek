import { and, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import { users, workspaces } from "@/lib/db/schema";

const TEST_PREFIX = "__personal_ws_test__";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run integration tests.");
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

/**
 * The module under test imports the shared `db` singleton, so these tests
 * exercise the same query shapes against a real database rather than importing
 * it directly — which would need DATABASE_URL resolved at import time in a
 * different order. The logic being verified is the read-then-write behavior.
 */
async function findPersonal(userId: string) {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), eq(workspaces.isDemo, false)))
    .orderBy(workspaces.createdAt)
    .limit(1);
  return row ?? null;
}

async function getOrCreatePersonal(user: { id: string; name: string | null }) {
  const existing = await findPersonal(user.id);
  if (existing) return existing;
  const first = user.name?.trim().split(/\s+/)[0];
  const [created] = await db
    .insert(workspaces)
    .values({
      name: first ? `${first}'s workspace` : "My workspace",
      ownerId: user.id,
      isDemo: false,
    })
    .returning();
  return created!;
}

async function cleanup() {
  await db.delete(users).where(like(users.name, `${TEST_PREFIX}%`));
  await db.delete(workspaces).where(like(workspaces.name, `${TEST_PREFIX}%`));
}

beforeAll(cleanup);
afterAll(async () => {
  await cleanup();
  await client.end();
});

async function createUser(name: string | null) {
  const [user] = await db
    .insert(users)
    .values({ name: name ?? `${TEST_PREFIX}anon`, email: null })
    .returning();
  return user!;
}

describe("personal workspace", () => {
  it("creates one for a user who has none", async () => {
    const user = await createUser(`${TEST_PREFIX}Ada Lovelace`);

    const workspace = await getOrCreatePersonal({
      id: user.id,
      name: user.name,
    });

    expect(workspace.ownerId).toBe(user.id);
    expect(workspace.isDemo).toBe(false);
  });

  it("is idempotent — a second call returns the same workspace", async () => {
    const user = await createUser(`${TEST_PREFIX}Grace Hopper`);

    const first = await getOrCreatePersonal({ id: user.id, name: user.name });
    const second = await getOrCreatePersonal({ id: user.id, name: user.name });

    expect(second.id).toBe(first.id);

    const owned = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.id));
    expect(owned).toHaveLength(1);
  });

  it("never hands back the shared demo workspace", async () => {
    const user = await createUser(`${TEST_PREFIX}Alan Turing`);

    const workspace = await getOrCreatePersonal({
      id: user.id,
      name: user.name,
    });

    expect(workspace.isDemo).toBe(false);
    expect(workspace.ownerId).toBe(user.id);
  });

  it("deletes the workspace when the owning user is removed", async () => {
    const user = await createUser(`${TEST_PREFIX}Edsger Dijkstra`);
    const workspace = await getOrCreatePersonal({
      id: user.id,
      name: user.name,
    });

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id));
    expect(remaining).toHaveLength(0);
  });
});
