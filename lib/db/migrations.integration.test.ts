import { readFileSync } from "node:fs";
import { join } from "node:path";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fakeEmbedding } from "@/lib/ai/fake-embedder";
import { EMBEDDING_MODEL_ID } from "@/lib/ai/provider";
import { l2Normalize } from "@/lib/rag/vector";

import { chunks, documents } from "./schema";
import {
  EMBEDDING_DIMENSIONS,
  cleanupTestRows,
  createTestClient,
  createTestWorkspace,
} from "./test-helpers";

/* The statement as the migrator runs it, read from the file rather than copied:
   a copy here would test itself. */
const classifier = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "..",
    "drizzle",
    "0011_a_vector_records_its_model.sql",
  ),
  "utf8",
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .find((statement) => statement.startsWith('UPDATE "chunks"'));

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));

afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

/** Mixed signs and no zeros, the shape measured on Gemini's vectors. */
const geminiShaped = Array.from(
  { length: EMBEDDING_DIMENSIONS },
  (_, i) => (((i * 7919) % 13) - 6.5) / 100,
);

/** Every component non-negative and most of them zero, by construction. */
const fakeShaped = l2Normalize(
  fakeEmbedding("Expenses are reimbursed within thirty days."),
);

/** Sign and sparsity disagree: either feature alone would label these, so neither may. */
const negativeWithZeros = [
  -1,
  ...new Array<number>(EMBEDDING_DIMENSIONS - 1).fill(0),
];
const positiveWithoutZeros = new Array<number>(EMBEDDING_DIMENSIONS).fill(
  1 / Math.sqrt(EMBEDDING_DIMENSIONS),
);

describe("migration 0011's classifier", () => {
  it("is in the migration file", () => {
    expect(classifier).toBeDefined();
  });

  it("labels a vector only when sign and sparsity agree, and only once", async () => {
    const workspace = await createTestWorkspace(db, { label: "migration" });
    const [document] = await db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        filename: "handbook.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      })
      .returning();

    const rows = {
      gemini: geminiShaped,
      fake: fakeShaped,
      negativeWithZeros,
      positiveWithoutZeros,
      noVector: null,
    };
    const inserted = await db
      .insert(chunks)
      .values(
        Object.values(rows).map((embedding, chunkIndex) => ({
          workspaceId: workspace.id,
          documentId: document!.id,
          chunkIndex,
          content: `chunk ${String(chunkIndex)}`,
          embedding,
          charStart: 0,
          charEnd: 8,
        })),
      )
      .returning({ id: chunks.id, chunkIndex: chunks.chunkIndex });

    await client.unsafe(classifier!);

    const labeled = await db
      .select({ chunkIndex: chunks.chunkIndex, model: chunks.embeddingModel })
      .from(chunks)
      .where(
        inArray(
          chunks.id,
          inserted.map((row) => row.id),
        ),
      );
    const labelOf = (name: keyof typeof rows) =>
      labeled.find((row) => row.chunkIndex === Object.keys(rows).indexOf(name))
        ?.model;

    expect(labelOf("gemini")).toBe(EMBEDDING_MODEL_ID);
    expect(labelOf("fake")).toBe("fake");
    expect(labelOf("negativeWithZeros")).toBeNull();
    expect(labelOf("positiveWithoutZeros")).toBeNull();
    expect(labelOf("noVector")).toBeNull();

    // Only unlabeled vectors are read, and an ambiguous one is never written.
    const again = await client.unsafe(classifier!);
    expect(again.count).toBe(0);
  });
});
