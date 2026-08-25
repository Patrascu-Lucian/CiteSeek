import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";
import { createQueuedDocument, insertChunks } from "@/lib/documents/queries";

import { retrieveLexical, type LexicalChunk } from "./lexical";

/**
 * The first test of this file. It is off the answer path by design (ADR 021) and
 * excluded from the coverage thresholds, so nothing would have caught a
 * reordering — `pnpm eval:retrieval` is the only other caller.
 */

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

const CONTENT = "Expenses are reimbursed within thirty days of approval.";

/** Identical text, so `ts_rank_cd` returns the same rank for every row and the
 * tiebreaker is the only thing deciding the order. */
async function tiedChunks(
  filenames: readonly string[],
  perDocument: number,
): Promise<string> {
  const user = await createTestUser(db, "lexical");
  const workspace = await createTestWorkspace(db, { ownerId: user.id });

  for (const filename of filenames) {
    const document = await createQueuedDocument(workspace.id, {
      filename,
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    await insertChunks(
      workspace.id,
      document.id,
      Array.from({ length: perDocument }, (_, index) => ({
        chunkIndex: index,
        content: CONTENT,
        charStart: index * CONTENT.length,
        charEnd: (index + 1) * CONTENT.length,
        pageNumber: 1,
      })),
    );
  }

  return workspace.id;
}

/** Ids differ between ingests by definition, so the order is compared by the
 * only thing that survives one. */
const shape = (chunks: LexicalChunk[]) =>
  chunks.map((chunk) => `${chunk.filename}#${String(chunk.charStart)}`);

describe("retrieveLexical", () => {
  it("returns the same order twice when ranks tie", async () => {
    const workspace = await tiedChunks(["handbook.pdf"], 6);

    const [first, second] = await Promise.all([
      retrieveLexical(workspace, "expenses reimbursed"),
      retrieveLexical(workspace, "expenses reimbursed"),
    ]);

    expect(first.map((chunk) => chunk.id)).toEqual(
      second.map((chunk) => chunk.id),
    );
  });

  /* Not cosmetic: equal ranks used to arrive in scan order, so an unrelated
     change to the plan moved MRR@8 from 0.53 to 0.52. Ordering by `chunks.id`
     then looked stable and was not — the eval harness re-ingests every run, and
     ids are minted per ingest, so two runs were never comparable. */
  it("orders tied ranks identically across separate ingests", async () => {
    const first = await tiedChunks(["beta.pdf", "alpha.pdf"], 3);
    const second = await tiedChunks(["beta.pdf", "alpha.pdf"], 3);

    const order = shape(await retrieveLexical(first, "expenses reimbursed"));

    expect(order).toEqual(
      shape(await retrieveLexical(second, "expenses reimbursed")),
    );
    expect(order).toEqual([
      "alpha.pdf#0",
      `alpha.pdf#${String(CONTENT.length)}`,
      `alpha.pdf#${String(CONTENT.length * 2)}`,
      "beta.pdf#0",
      `beta.pdf#${String(CONTENT.length)}`,
      `beta.pdf#${String(CONTENT.length * 2)}`,
    ]);
  });

  it("stays inside its workspace", async () => {
    const mine = await tiedChunks(["handbook.pdf"], 2);
    const other = await tiedChunks(["handbook.pdf"], 2);

    const found = await retrieveLexical(other, "expenses reimbursed");

    expect(found).toHaveLength(2);
    expect(
      (await retrieveLexical(mine, "expenses reimbursed")).map((c) => c.id),
    ).not.toEqual(found.map((c) => c.id));
  });
});
