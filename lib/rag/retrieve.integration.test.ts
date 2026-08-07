import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Embedder } from "@/lib/rag/embeddings";
import {
  EMBEDDING_DIMENSIONS,
  cleanupTestRows,
  createTestClient,
  createTestWorkspace,
  unitVector,
} from "@/lib/db/test-helpers";
import { chunks } from "@/lib/db/schema";
import {
  createQueuedDocument,
  insertChunks,
  setChunkEmbeddings,
} from "@/lib/documents/queries";

import { retrieveChunks } from "./retrieve";
import { MAX_DISTANCE_BY_PROVIDER } from "./retrieval-config";
import { l2Normalize } from "./vector";

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

/**
 * A query embedder that always returns the same vector, so distances in these
 * tests are arithmetic rather than semantic. The fake embedder cannot be used
 * here: its vectors are deterministic hashes, which makes them reproducible but
 * says nothing about which of two chunks is nearer.
 */
function fixedEmbedder(vector: number[]): Embedder {
  return () => Promise.resolve({ vectors: [vector], tokens: 4 });
}

/**
 * A unit vector between `unitVector(0)` and `unitVector(1)`. Cosine distance from
 * `unitVector(0)` is 1 - cos(45°) ≈ 0.293 — comfortably inside the floor, and
 * strictly further away than an exact match at 0.
 */
function diagonalVector(): number[] {
  const values = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  values[0] = 1;
  values[1] = 1;
  return l2Normalize(values);
}

async function seedChunk(
  workspaceId: string,
  options: {
    filename?: string;
    content: string;
    embedding: number[] | null;
    chunkIndex?: number;
    documentId?: string;
  },
) {
  const documentId =
    options.documentId ??
    (
      await createQueuedDocument(workspaceId, {
        filename: options.filename ?? "handbook.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      })
    ).id;

  const [inserted] = await insertChunks(workspaceId, documentId, [
    {
      chunkIndex: options.chunkIndex ?? 0,
      content: options.content,
      charStart: 0,
      charEnd: options.content.length,
      pageNumber: 3,
    },
  ]);

  if (options.embedding) {
    await setChunkEmbeddings(workspaceId, documentId, [
      { id: inserted!.id, embedding: options.embedding },
    ]);
  }

  return { documentId, chunkId: inserted!.id };
}

describe("retrieveChunks", () => {
  it("orders passages by distance, closest first", async () => {
    const workspace = await createTestWorkspace(db);
    await seedChunk(workspace.id, {
      content: "The exact match.",
      embedding: unitVector(0),
    });
    await seedChunk(workspace.id, {
      content: "The nearby match.",
      embedding: diagonalVector(),
    });

    const { chunks: results } = await retrieveChunks(workspace.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
    });

    expect(results.map((r) => r.content)).toEqual([
      "The exact match.",
      "The nearby match.",
    ]);
    // Marker [1] must be the closest passage — the client resolves markers by
    // position, so a wrong order is a wrong citation.
    expect(results[0]!.distance).toBeLessThan(results[1]!.distance);
    expect(results[0]!.distance).toBeCloseTo(0, 5);
  });

  it("excludes passages beyond the relevance floor", async () => {
    const workspace = await createTestWorkspace(db);
    await seedChunk(workspace.id, {
      content: "Relevant.",
      embedding: unitVector(0),
    });
    await seedChunk(workspace.id, {
      // Orthogonal to the query: cosine distance 1, well beyond the floor.
      content: "Unrelated.",
      embedding: unitVector(5),
    });

    const { chunks: results } = await retrieveChunks(workspace.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
    });

    expect(results.map((r) => r.content)).toEqual(["Relevant."]);
    // These tests inject their own embedder, so the fake provider's floor is
    // the one in force.
    expect(
      results.every((r) => r.distance <= MAX_DISTANCE_BY_PROVIDER.fake),
    ).toBe(true);
  });

  it("returns nothing when every passage is beyond the floor", async () => {
    const workspace = await createTestWorkspace(db);
    await seedChunk(workspace.id, {
      content: "Unrelated.",
      embedding: unitVector(5),
    });

    const { chunks: results } = await retrieveChunks(workspace.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
    });

    // This is the input that makes "I don't know" structural: no passages means
    // the route never calls the model, so there is nothing to fabricate from.
    expect(results).toEqual([]);
  });

  it("cannot return another workspace's passages", async () => {
    const mine = await createTestWorkspace(db, { label: "mine" });
    const theirs = await createTestWorkspace(db, { label: "theirs" });

    await seedChunk(theirs.id, {
      filename: "their-secrets.pdf",
      content: "Their confidential passage.",
      embedding: unitVector(0),
    });

    const { chunks: results } = await retrieveChunks(mine.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
    });

    // An exact-match embedding in a workspace the caller does not own. The only
    // thing keeping it out is the workspace filter in SQL.
    expect(results).toEqual([]);
  });

  it("ignores chunks that have not been embedded yet", async () => {
    const workspace = await createTestWorkspace(db);
    await seedChunk(workspace.id, {
      content: "Still processing.",
      embedding: null,
    });

    const { chunks: results } = await retrieveChunks(workspace.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
    });

    // A null embedding yields a null distance, which sorts *ahead* of every real
    // distance under ASC. Without the IS NOT NULL guard a half-ingested document
    // would outrank every genuine match.
    expect(results).toEqual([]);
  });

  it("returns nothing for an empty workspace", async () => {
    const workspace = await createTestWorkspace(db);

    const { chunks: results } = await retrieveChunks(workspace.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
    });

    expect(results).toEqual([]);
  });

  it("returns nothing for a blank query without embedding it", async () => {
    const workspace = await createTestWorkspace(db);
    await seedChunk(workspace.id, {
      content: "Something.",
      embedding: unitVector(0),
    });

    let called = false;
    const { chunks: results } = await retrieveChunks(workspace.id, "   ", {
      embedder: () => {
        called = true;
        return Promise.resolve({ vectors: [unitVector(0)], tokens: 4 });
      },
    });

    expect(results).toEqual([]);
    expect(called).toBe(false);
  });

  it("carries the citation anchors retrieval exists to produce", async () => {
    const workspace = await createTestWorkspace(db);
    const { documentId, chunkId } = await seedChunk(workspace.id, {
      filename: "policies.pdf",
      content: "Expenses are reimbursed within 30 days.",
      embedding: unitVector(0),
    });

    const {
      chunks: [result],
    } = await retrieveChunks(workspace.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
    });

    expect(result).toMatchObject({
      id: chunkId,
      documentId,
      filename: "policies.pdf",
      content: "Expenses are reimbursed within 30 days.",
      charStart: 0,
      charEnd: "Expenses are reimbursed within 30 days.".length,
      pageNumber: 3,
    });
  });

  it("respects an explicit limit", async () => {
    const workspace = await createTestWorkspace(db);
    const { documentId } = await seedChunk(workspace.id, {
      content: "First.",
      embedding: unitVector(0),
      chunkIndex: 0,
    });
    await seedChunk(workspace.id, {
      documentId,
      content: "Second.",
      embedding: diagonalVector(),
      chunkIndex: 1,
    });

    const { chunks: results } = await retrieveChunks(workspace.id, "anything", {
      embedder: fixedEmbedder(unitVector(0)),
      limit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe("First.");
  });
});

describe("retrieveChunks under an HNSW-first plan", () => {
  // Forced, because row count cannot produce this plan at test scale — at 400 rows
  // the planner filters and sorts, which is exact. `enable_seqscan = off` alone was
  // not enough; removing the sort is what moves ordering into the vector index.
  // Measured in ADR 026: 60 crowding rows at `ef_search = 10` starves the target.
  const FORCED_PLAN =
    "-c enable_sort=off -c enable_seqscan=off -c hnsw.ef_search=10";
  const FOREIGN_CHUNKS = 60;

  /** Nearer to the query than the target's `diagonalVector`, which is the point. */
  function crowdVector(seed: number): number[] {
    const values = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    values[0] = 1;
    values[1 + (seed % 100)] = 0.05;
    return l2Normalize(values);
  }

  async function retrieveUnderForcedPlan(workspaceId: string) {
    const base = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;
    const url = new URL(base);
    // Neon's pooler rejects startup options; the unpooled endpoint and CI's
    // Postgres service container both accept them.
    url.searchParams.set("options", FORCED_PLAN);

    // `lib/db/index.ts` caches its pool on globalThis outside production, so a
    // fresh import returns the old connection unless this is cleared first.
    type ForcedClient = {
      end: () => Promise<void>;
      unsafe: (sql: string) => Promise<{ enable_sort: string }[]>;
    };
    type DbGlobal = { __citeseekClient?: ForcedClient };
    const dbGlobal = () => globalThis as unknown as DbGlobal;

    const cached = dbGlobal().__citeseekClient;
    const previousUrl = process.env.DATABASE_URL;

    delete dbGlobal().__citeseekClient;
    process.env.DATABASE_URL = url.toString();
    vi.resetModules();

    try {
      const { retrieveChunks: forced } = await import("./retrieve");
      const results = await forced(workspaceId, "anything", {
        embedder: fixedEmbedder(unitVector(0)),
      });

      // If `?options=` ever stops being forwarded, the forced plan silently
      // becomes the default plan — which is exact, so this test would pass while
      // asserting nothing.
      const [setting] = await dbGlobal().__citeseekClient!.unsafe(
        "SELECT current_setting('enable_sort') AS enable_sort",
      );
      expect(setting?.enable_sort).toBe("off");

      return results;
    } finally {
      await dbGlobal().__citeseekClient?.end();
      dbGlobal().__citeseekClient = cached;
      process.env.DATABASE_URL = previousUrl;
      vi.resetModules();
    }
  }

  it("still finds a small tenant's passage in a table crowded by another", async () => {
    const foreign = await createTestWorkspace(db);
    const { documentId: foreignDocument } = await seedChunk(foreign.id, {
      content: "foreign 0",
      embedding: crowdVector(0),
    });
    await db.insert(chunks).values(
      Array.from({ length: FOREIGN_CHUNKS - 1 }, (_, i) => ({
        workspaceId: foreign.id,
        documentId: foreignDocument,
        chunkIndex: i + 1,
        content: `foreign ${i + 1}`,
        embedding: crowdVector(i + 1),
        charStart: 0,
        charEnd: 10,
      })),
    );

    const target = await createTestWorkspace(db);
    await seedChunk(target.id, {
      content: "The target passage.",
      embedding: diagonalVector(),
    });

    const { chunks: results } = await retrieveUnderForcedPlan(target.id);

    // Without the scope filter on `chunks` and an iterative scan, this is empty:
    // the index returns the 10 nearest rows, all foreign, and the join drops them.
    expect(results.map((r) => r.content)).toEqual(["The target passage."]);
  });
});
