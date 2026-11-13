import { readFileSync } from "node:fs";
import { join } from "node:path";

import type postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { fakeEmbedding } from "@/lib/ai/fake-embedder";
import { EMBEDDING_MODEL_ID } from "@/lib/ai/provider";
import { l2Normalize } from "@/lib/rag/vector";

import { EMBEDDING_DIMENSIONS, createTestClient } from "./test-helpers";

/** A migration's statements as the migrator runs them, read from the file rather
 * than copied: a copy here would test itself. */
function statementsOf(file: string): string[] {
  return readFileSync(
    join(import.meta.dirname, "..", "..", "drizzle", file),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.startsWith("--"))
        .join("\n")
        .trim(),
    );
}

const relabel = statementsOf("0011_a_vector_records_its_model.sql").find(
  (statement) => statement.startsWith('UPDATE "chunks"'),
);

const { client } = createTestClient();

afterAll(() => client.end());

/* The statements run verbatim against a temporary `chunks`: Postgres resolves the
   name in the session's temporary schema first. Its rows, unlabeled vectors
   included, are gone at commit and never reach the real table. */
async function withShadowChunks<T>(
  rows: readonly { embedding: number[] | null; model?: string }[],
  run: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return client.begin(async (sql) => {
    await sql.unsafe(
      "CREATE TEMP TABLE chunks (LIKE public.chunks INCLUDING DEFAULTS) ON COMMIT DROP",
    );
    for (const [chunkIndex, row] of rows.entries()) {
      await sql`
        insert into chunks (document_id, workspace_id, chunk_index, content,
          char_start, char_end, embedding, embedding_model)
        values (gen_random_uuid(), gen_random_uuid(), ${chunkIndex}, 'chunk', 0, 5,
          ${row.embedding ? `[${row.embedding.join(",")}]` : null}::vector,
          ${row.model ?? null})`;
    }
    return run(sql);
  });
}

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

describe("migration 0011's relabel", () => {
  it("is in the migration file", () => {
    expect(relabel).toBeDefined();
  });

  it("labels a vector only when sign and sparsity agree, and only once", async () => {
    const rows = [
      geminiShaped,
      fakeShaped,
      negativeWithZeros,
      positiveWithoutZeros,
      null,
    ].map((embedding) => ({ embedding }));

    const { labels, again } = await withShadowChunks(rows, async (sql) => {
      await sql.unsafe(relabel!);
      const labeled = await sql<{ model: string | null }[]>`
        select embedding_model as model from chunks order by chunk_index`;
      // Only unlabeled vectors are read, and an ambiguous one is never written.
      const second = await sql.unsafe(relabel!);
      return { labels: labeled.map((row) => row.model), again: second.count };
    });

    expect(labels).toEqual([EMBEDDING_MODEL_ID, "fake", null, null, null]);
    expect(again).toBe(0);
  });
});
