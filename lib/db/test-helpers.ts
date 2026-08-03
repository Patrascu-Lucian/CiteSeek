import { drizzle } from "drizzle-orm/postgres-js";
import { like } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "./schema";
import { usageEvents, users, workspaces } from "./schema";

/** Integration suites write to a real database, so rows are prefixed and removed.
 * A suite inventing its own prefix leaves rows the next run depends on. */

export const TEST_PREFIX = "__integration_test__";

export const EMBEDDING_DIMENSIONS = 768;

/** Asserted instead of message text: Drizzle wraps driver errors and both layers'
 * wording can change between releases. The code is wire protocol. */
export const PG_ERROR = {
  dataException: "22000",
  notNullViolation: "23502",
  foreignKeyViolation: "23503",
  uniqueViolation: "23505",
} as const;

export function createTestClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set to run integration tests. See .env.example.",
    );
  }

  const client = postgres(connectionString, { max: 1 });
  return { client, db: drizzle(client, { schema }) };
}

export type TestDatabase = ReturnType<typeof createTestClient>["db"];

/** Workspaces cascade to documents and chunks; users to workspaces, accounts and
 * sessions. */
export async function cleanupTestRows(db: TestDatabase): Promise<void> {
  await db.delete(users).where(like(users.name, `${TEST_PREFIX}%`));
  await db.delete(workspaces).where(like(workspaces.name, `${TEST_PREFIX}%`));
}

/** Not covered by `cleanupTestRows`: usage rows carry no workspace, so no prefix
 * and no cascade. The global-cap query reads *every* row, so a leftover is a
 * wrong answer rather than noise. */
export async function clearUsageEvents(db: TestDatabase): Promise<void> {
  await db.delete(usageEvents);
}

/** Throws if the operation unexpectedly succeeds, so a silently-passing constraint
 * test cannot masquerade as a green one. */
export async function failureOf(
  operation: () => Promise<unknown>,
): Promise<{ code?: string; message: string }> {
  try {
    await operation();
  } catch (error) {
    const driverError = (error as { cause?: unknown }).cause ?? error;
    return {
      code: (driverError as { code?: string }).code,
      message: (driverError as { message?: string }).message ?? String(error),
    };
  }
  throw new Error("Expected the operation to fail, but it succeeded.");
}

/** A deterministic unit vector, so cosine distances are exactly predictable. */
export function unitVector(hotIndex: number): number[] {
  const values = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  values[hotIndex] = 1;
  return values;
}

export async function createTestUser(db: TestDatabase, label = "user") {
  const [user] = await db
    .insert(users)
    .values({ name: `${TEST_PREFIX}${label}` })
    .returning();

  return user!;
}

export async function createTestWorkspace(
  db: TestDatabase,
  options: { ownerId?: string; label?: string } = {},
) {
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: `${TEST_PREFIX}${options.label ?? "workspace"}`,
      ownerId: options.ownerId ?? null,
    })
    .returning();

  return workspace!;
}
