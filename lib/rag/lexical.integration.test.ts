import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";
import { createQueuedDocument, insertChunks } from "@/lib/documents/queries";

import { retrieveLexical } from "./lexical";

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

/** Identical text, so `ts_rank_cd` returns the same rank for every row and the
 * tiebreaker is the only thing deciding the order. */
async function tiedChunks(count: number) {
  const user = await createTestUser(db, "lexical");
  const workspace = await createTestWorkspace(db, { ownerId: user.id });
  const document = await createQueuedDocument(workspace.id, {
    filename: "handbook.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
  });

  const content = "Expenses are reimbursed within thirty days of approval.";
  await insertChunks(
    workspace.id,
    document.id,
    Array.from({ length: count }, (_, index) => ({
      chunkIndex: index,
      content,
      charStart: 0,
      charEnd: content.length,
      pageNumber: 1,
    })),
  );

  return workspace;
}

describe("retrieveLexical", () => {
  it("returns the same order twice when ranks tie", async () => {
    const workspace = await tiedChunks(6);

    const [first, second] = await Promise.all([
      retrieveLexical(workspace.id, "expenses reimbursed"),
      retrieveLexical(workspace.id, "expenses reimbursed"),
    ]);

    expect(first.map((chunk) => chunk.id)).toEqual(
      second.map((chunk) => chunk.id),
    );
  });

  /* Not cosmetic: equal ranks used to arrive in scan order, so an unrelated
     change to the plan moved MRR@8 from 0.53 to 0.52. An evaluation that wobbles
     weakens every comparison made against it. */
  it("breaks ties on a stable key rather than the scan", async () => {
    const workspace = await tiedChunks(6);

    const ids = (
      await retrieveLexical(workspace.id, "expenses reimbursed")
    ).map((chunk) => chunk.id);

    expect(ids).toEqual([...ids].sort());
  });

  it("stays inside its workspace", async () => {
    const mine = await tiedChunks(2);
    const other = await tiedChunks(2);

    const found = await retrieveLexical(other.id, "expenses reimbursed");

    expect(found.every((chunk) => chunk.id !== undefined)).toBe(true);
    expect(
      (await retrieveLexical(mine.id, "expenses reimbursed")).map((c) => c.id),
    ).not.toEqual(found.map((c) => c.id));
  });
});
