import { cosineDistance, eq, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "./schema";
import { chunks, documents, workspaces } from "./schema";

// DATABASE_URL is loaded by vitest.integration.config.ts before workers fork.
const EMBEDDING_DIMENSIONS = 768;

/** Prefix every row this suite creates so cleanup can find them unambiguously. */
const TEST_PREFIX = "__integration_test__";

/**
 * SQLSTATE codes. Asserting on these rather than on message text: Drizzle wraps
 * driver errors in its own "Failed query: ..." message, and the wording of both
 * layers is free to change between releases. The code is part of the Postgres
 * wire protocol and is not.
 */
const PG_ERROR = {
  dataException: "22000",
  notNullViolation: "23502",
  foreignKeyViolation: "23503",
  uniqueViolation: "23505",
} as const;

async function failureOf(
  operation: () => Promise<unknown>,
): Promise<{ code?: string; message: string }> {
  try {
    await operation();
  } catch (error) {
    // Drizzle wraps the driver error; the SQLSTATE lives on the cause.
    const driverError = (error as { cause?: unknown }).cause ?? error;
    return {
      code: (driverError as { code?: string }).code,
      message: (driverError as { message?: string }).message ?? String(error),
    };
  }
  throw new Error("Expected the operation to fail, but it succeeded.");
}

/** A deterministic unit vector, so cosine distances are exactly predictable. */
function unitVector(hotIndex: number): number[] {
  const values = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  values[hotIndex] = 1;
  return values;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set to run integration tests. See .env.example.",
  );
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function cleanup() {
  // Workspaces cascade to documents, which cascade to chunks.
  await db.delete(workspaces).where(like(workspaces.name, `${TEST_PREFIX}%`));
}

beforeAll(cleanup);

afterAll(async () => {
  await cleanup();
  await client.end();
});

async function createWorkspaceWithDocument() {
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `${TEST_PREFIX}workspace` })
    .returning();

  const [document] = await db
    .insert(documents)
    .values({
      workspaceId: workspace!.id,
      filename: "handbook.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    })
    .returning();

  return { workspace: workspace!, document: document! };
}

describe("chunks.embedding", () => {
  it("round-trips a 768-dimension vector", async () => {
    const { document } = await createWorkspaceWithDocument();

    const [inserted] = await db
      .insert(chunks)
      .values({
        documentId: document.id,
        chunkIndex: 0,
        content: "The retrieval index is rebuilt nightly.",
        embedding: unitVector(0),
        pageNumber: 4,
        charStart: 120,
        charEnd: 160,
      })
      .returning();

    expect(inserted?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(inserted?.embedding?.[0]).toBe(1);
  });

  it("rejects a vector of the wrong dimension", async () => {
    const { document } = await createWorkspaceWithDocument();

    // This is what makes the 768 decision enforceable rather than a convention:
    // the database itself refuses a mismatched vector.
    const failure = await failureOf(() =>
      db.insert(chunks).values({
        documentId: document.id,
        chunkIndex: 0,
        content: "wrong size",
        embedding: new Array<number>(512).fill(0),
        charStart: 0,
        charEnd: 10,
      }),
    );

    expect(failure.code).toBe(PG_ERROR.dataException);
    expect(failure.message).toMatch(/expected 768 dimensions, not 512/i);
  });

  it("orders neighbors by cosine distance", async () => {
    const { document } = await createWorkspaceWithDocument();

    await db.insert(chunks).values([
      {
        documentId: document.id,
        chunkIndex: 0,
        content: "near",
        embedding: unitVector(0),
        charStart: 0,
        charEnd: 4,
      },
      {
        documentId: document.id,
        chunkIndex: 1,
        content: "far",
        embedding: unitVector(500),
        charStart: 5,
        charEnd: 8,
      },
    ]);

    const distance = cosineDistance(chunks.embedding, unitVector(0));

    const results = await db
      .select({ content: chunks.content, distance })
      .from(chunks)
      .where(eq(chunks.documentId, document.id))
      .orderBy(distance);

    expect(results.map((r) => r.content)).toEqual(["near", "far"]);
    expect(Number(results[0]?.distance)).toBeCloseTo(0, 5);
  });
});

describe("citation anchors", () => {
  it("requires a character span on every chunk", async () => {
    const { document } = await createWorkspaceWithDocument();

    // Citations are the product. A chunk with no span cannot be linked back to
    // its source passage, so the schema refuses to store one.
    const failure = await failureOf(() =>
      db.execute(sql`
        INSERT INTO chunks (document_id, chunk_index, content)
        VALUES (${document.id}, 0, 'no anchor')
      `),
    );

    expect(failure.code).toBe(PG_ERROR.notNullViolation);
    expect(failure.message).toMatch(/char_start/i);
  });
});

describe("referential integrity", () => {
  it("cascades deletes from workspace through documents to chunks", async () => {
    const { workspace, document } = await createWorkspaceWithDocument();

    await db.insert(chunks).values({
      documentId: document.id,
      chunkIndex: 0,
      content: "orphan candidate",
      embedding: unitVector(1),
      charStart: 0,
      charEnd: 16,
    });

    await db.delete(workspaces).where(eq(workspaces.id, workspace.id));

    const remainingDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.id, document.id));
    const remainingChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id));

    expect(remainingDocuments).toHaveLength(0);
    expect(remainingChunks).toHaveLength(0);
  });

  it("rejects a chunk whose document does not exist", async () => {
    const failure = await failureOf(() =>
      db.insert(chunks).values({
        documentId: "00000000-0000-0000-0000-000000000000",
        chunkIndex: 0,
        content: "dangling",
        embedding: unitVector(2),
        charStart: 0,
        charEnd: 8,
      }),
    );

    expect(failure.code).toBe(PG_ERROR.foreignKeyViolation);
  });
});

describe("demo workspace", () => {
  it("permits at most one", async () => {
    // Ensure one exists regardless of whether the seed has run, so the assertion
    // does not depend on database state.
    const [existing] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.isDemo, true))
      .limit(1);

    if (!existing) {
      await db
        .insert(workspaces)
        .values({ name: `${TEST_PREFIX}demo`, isDemo: true });
    }

    const failure = await failureOf(() =>
      db
        .insert(workspaces)
        .values({ name: `${TEST_PREFIX}second demo`, isDemo: true }),
    );

    expect(failure.code).toBe(PG_ERROR.uniqueViolation);
    expect(failure.message).toMatch(/workspaces_single_demo_idx/);
  });

  it("allows many non-demo workspaces", async () => {
    await db
      .insert(workspaces)
      .values([{ name: `${TEST_PREFIX}a` }, { name: `${TEST_PREFIX}b` }]);

    const rows = await db
      .select()
      .from(workspaces)
      .where(like(workspaces.name, `${TEST_PREFIX}%`));

    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
