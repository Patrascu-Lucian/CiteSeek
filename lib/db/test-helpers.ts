import { drizzle } from "drizzle-orm/postgres-js";
import { like } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "./schema";
import { usageEvents, users, workspaces } from "./schema";

/**
 * Shared scaffolding for integration suites.
 *
 * These tests write to a real database, so every row they create is prefixed and
 * removed afterward. Centralizing that here keeps cleanup consistent — a suite
 * that invents its own prefix leaves rows behind, and the next run's assertions
 * start depending on them.
 */

/** Every row created by an integration test carries this prefix in its name. */
export const TEST_PREFIX = "__integration_test__";

export const EMBEDDING_DIMENSIONS = 768;

/**
 * SQLSTATE codes. Asserting on these rather than on message text: Drizzle wraps
 * driver errors in its own "Failed query: ..." message, and the wording of both
 * layers is free to change between releases. The code is part of the Postgres
 * wire protocol and is not.
 */
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

/**
 * Removes everything a suite created. Workspaces cascade to documents and
 * chunks; users cascade to their workspaces, accounts and sessions.
 */
export async function cleanupTestRows(db: TestDatabase): Promise<void> {
  await db.delete(users).where(like(users.name, `${TEST_PREFIX}%`));
  await db.delete(workspaces).where(like(workspaces.name, `${TEST_PREFIX}%`));
}

/**
 * Empties `usage_events`.
 *
 * Not covered by `cleanupTestRows`: usage rows are deliberately not
 * workspace-scoped, so nothing about them carries the test prefix, and rows with
 * no workspace do not cascade. The global-cap query reads *every* row by
 * definition, which makes a leftover from another test a wrong answer rather
 * than noise.
 */
export async function clearUsageEvents(db: TestDatabase): Promise<void> {
  await db.delete(usageEvents);
}

/**
 * Runs an operation expected to fail and returns the driver error's SQLSTATE.
 * Throws if it unexpectedly succeeds, so a silently-passing constraint test
 * cannot masquerade as a green one.
 */
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
