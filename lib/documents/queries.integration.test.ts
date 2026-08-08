import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { chunks, documents } from "@/lib/db/schema";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
  unitVector,
} from "@/lib/db/test-helpers";
import {
  countChunks,
  createQueuedDocument,
  deleteDocumentInWorkspace,
  failStaleProcessing,
  findDocumentInWorkspace,
  insertChunks,
  listDocuments,
  listUnembeddedChunks,
  setChunkEmbeddings,
  updateDocument,
} from "./queries";
import { deleteUserAccount } from "@/lib/users/deletion";

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

async function seedDocument(workspaceId: string, filename = "handbook.pdf") {
  return createQueuedDocument(workspaceId, {
    filename,
    mimeType: "application/pdf",
    sizeBytes: 2048,
  });
}

const CHUNK = {
  chunkIndex: 0,
  content: "Retrieval grounds answers in sources.",
  charStart: 0,
  charEnd: 37,
  pageNumber: 1,
};

describe("document lifecycle", () => {
  it("creates a document in the queued state", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);

    expect(document.status).toBe("queued");
    expect(document.workspaceId).toBe(workspace.id);

    // Read it back rather than inspecting the insert's return value: the insert
    // deliberately returns only the columns it is asked for, so that unrelated
    // schema drift cannot break the upload path. What matters is the stored
    // state — a queued document has no extracted text yet.
    const stored = await findDocumentInWorkspace(workspace.id, document.id);
    expect(stored!.contentText).toBeNull();
    expect(stored!.pageSpans).toBeNull();
  });

  it("stores extracted text and page spans", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);

    const updated = await updateDocument(workspace.id, document.id, {
      status: "ready",
      contentText: "Page one text\n\nPage two text",
      pageSpans: [
        { pageNumber: 1, charStart: 0, charEnd: 13 },
        { pageNumber: 2, charStart: 15, charEnd: 28 },
      ],
      pageCount: 2,
      chunkCount: 2,
    });

    expect(updated?.status).toBe("ready");
    expect(updated?.pageSpans).toHaveLength(2);
    // The invariant citations depend on, checked through a real jsonb round trip.
    expect(
      updated!.contentText!.slice(
        updated!.pageSpans![1]!.charStart,
        updated!.pageSpans![1]!.charEnd,
      ),
    ).toBe("Page two text");
  });

  it("advances updatedAt on every write", async () => {
    // The stale-processing watchdog reads this. A timestamp that never moves
    // would get a working document marked dead.
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);

    await new Promise((resolve) => setTimeout(resolve, 10));
    const updated = await updateDocument(workspace.id, document.id, {
      status: "processing",
    });

    expect(updated!.updatedAt.getTime()).toBeGreaterThan(
      document.updatedAt.getTime(),
    );
  });

  it("reports embedded chunk progress", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);

    await insertChunks(workspace.id, document.id, [
      CHUNK,
      { ...CHUNK, chunkIndex: 1, charStart: 40, charEnd: 60 },
    ]);

    const before = await listDocuments(workspace.id);
    expect(before[0]!.embeddedChunkCount).toBe(0);

    const pending = await listUnembeddedChunks(workspace.id, document.id);
    await setChunkEmbeddings(workspace.id, document.id, [
      { id: pending[0]!.id, embedding: unitVector(0) },
    ]);

    const after = await listDocuments(workspace.id);
    expect(after[0]!.embeddedChunkCount).toBe(1);
  });

  it("attributes chunk counts to the right document", async () => {
    // The assertion that catches a count which is structurally broken rather
    // than merely zero. An earlier correlated-subquery version returned 0 for
    // every document, and a test expecting 0 passed for entirely the wrong
    // reason. Two documents with *different* counts cannot both be satisfied by
    // a bug.
    const workspace = await createTestWorkspace(db);
    const [first, second] = await Promise.all([
      seedDocument(workspace.id, "one.pdf"),
      seedDocument(workspace.id, "two.pdf"),
    ]);

    await insertChunks(workspace.id, first.id, [CHUNK]);
    await insertChunks(workspace.id, second.id, [
      CHUNK,
      { ...CHUNK, chunkIndex: 1, charStart: 40, charEnd: 60 },
      { ...CHUNK, chunkIndex: 2, charStart: 70, charEnd: 90 },
    ]);

    // Embed one chunk of the first document, two of the second.
    const firstPending = await listUnembeddedChunks(workspace.id, first.id);
    await setChunkEmbeddings(workspace.id, first.id, [
      { id: firstPending[0]!.id, embedding: unitVector(0) },
    ]);

    const secondPending = await listUnembeddedChunks(workspace.id, second.id);
    await setChunkEmbeddings(workspace.id, second.id, [
      { id: secondPending[0]!.id, embedding: unitVector(1) },
      { id: secondPending[1]!.id, embedding: unitVector(2) },
    ]);

    const listed = await listDocuments(workspace.id);
    const byName = new Map(listed.map((d) => [d.filename, d]));

    expect(byName.get("one.pdf")!.embeddedChunkCount).toBe(1);
    expect(byName.get("two.pdf")!.embeddedChunkCount).toBe(2);
  });

  it("reports zero for a document with no chunks at all", async () => {
    // LEFT JOIN, not INNER: a queued document must still appear in the list.
    const workspace = await createTestWorkspace(db);
    await seedDocument(workspace.id, "empty.pdf");

    const listed = await listDocuments(workspace.id);

    expect(listed).toHaveLength(1);
    expect(listed[0]!.embeddedChunkCount).toBe(0);
  });

  it("lists only unembedded chunks, so retry resumes rather than restarts", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);

    await insertChunks(workspace.id, document.id, [
      CHUNK,
      { ...CHUNK, chunkIndex: 1, charStart: 40, charEnd: 60 },
      { ...CHUNK, chunkIndex: 2, charStart: 70, charEnd: 90 },
    ]);

    const all = await listUnembeddedChunks(workspace.id, document.id);
    expect(all).toHaveLength(3);

    await setChunkEmbeddings(workspace.id, document.id, [
      { id: all[0]!.id, embedding: unitVector(1) },
    ]);

    const remaining = await listUnembeddedChunks(workspace.id, document.id);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((c) => c.chunkIndex)).toEqual([1, 2]);
  });

  it("deletes a document and its chunks together", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);
    await insertChunks(workspace.id, document.id, [CHUNK]);

    expect(await deleteDocumentInWorkspace(workspace.id, document.id)).toBe(
      true,
    );

    const orphans = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id));
    expect(orphans).toHaveLength(0);
  });
});

describe("tenant isolation", () => {
  it("does not list another workspace's documents", async () => {
    const [mine, theirs] = await Promise.all([
      createTestWorkspace(db, { label: "mine" }),
      createTestWorkspace(db, { label: "theirs" }),
    ]);
    await seedDocument(theirs.id, "secret.pdf");

    const visible = await listDocuments(mine.id);

    expect(visible.map((d) => d.filename)).not.toContain("secret.pdf");
    expect(visible).toHaveLength(0);
  });

  it("does not find another workspace's document by id", async () => {
    // Guessing a UUID must not be enough. This is the check that makes ids
    // unguessable-or-not irrelevant.
    const [mine, theirs] = await Promise.all([
      createTestWorkspace(db, { label: "mine" }),
      createTestWorkspace(db, { label: "theirs" }),
    ]);
    const theirDocument = await seedDocument(theirs.id);

    expect(await findDocumentInWorkspace(mine.id, theirDocument.id)).toBeNull();
  });

  it("refuses to update another workspace's document", async () => {
    const [mine, theirs] = await Promise.all([
      createTestWorkspace(db, { label: "mine" }),
      createTestWorkspace(db, { label: "theirs" }),
    ]);
    const theirDocument = await seedDocument(theirs.id);

    const result = await updateDocument(mine.id, theirDocument.id, {
      status: "failed",
      error: "tampered",
    });

    expect(result).toBeNull();
    const untouched = await findDocumentInWorkspace(
      theirs.id,
      theirDocument.id,
    );
    expect(untouched!.status).toBe("queued");
    expect(untouched!.error).toBeNull();
  });

  it("refuses to delete another workspace's document", async () => {
    const [mine, theirs] = await Promise.all([
      createTestWorkspace(db, { label: "mine" }),
      createTestWorkspace(db, { label: "theirs" }),
    ]);
    const theirDocument = await seedDocument(theirs.id);

    expect(await deleteDocumentInWorkspace(mine.id, theirDocument.id)).toBe(
      false,
    );
    expect(
      await findDocumentInWorkspace(theirs.id, theirDocument.id),
    ).not.toBeNull();
  });

  it("does not read another workspace's chunks", async () => {
    // Chunks carry no workspace_id of their own; they inherit it through their
    // document. If a query ever stops joining, this is what notices.
    const [mine, theirs] = await Promise.all([
      createTestWorkspace(db, { label: "mine" }),
      createTestWorkspace(db, { label: "theirs" }),
    ]);
    const theirDocument = await seedDocument(theirs.id);
    await insertChunks(theirs.id, theirDocument.id, [CHUNK]);

    expect(await listUnembeddedChunks(mine.id, theirDocument.id)).toHaveLength(
      0,
    );
    expect(await countChunks(mine.id, theirDocument.id)).toBe(0);
    expect(await countChunks(theirs.id, theirDocument.id)).toBe(1);
  });

  it("refuses to attach chunks to another workspace's document", async () => {
    const [mine, theirs] = await Promise.all([
      createTestWorkspace(db, { label: "mine" }),
      createTestWorkspace(db, { label: "theirs" }),
    ]);
    const theirDocument = await seedDocument(theirs.id);

    const inserted = await insertChunks(mine.id, theirDocument.id, [CHUNK]);

    expect(inserted).toHaveLength(0);
    expect(await countChunks(theirs.id, theirDocument.id)).toBe(0);
  });

  it("refuses to write embeddings into another workspace's chunks", async () => {
    const [mine, theirs] = await Promise.all([
      createTestWorkspace(db, { label: "mine" }),
      createTestWorkspace(db, { label: "theirs" }),
    ]);
    const theirDocument = await seedDocument(theirs.id);
    await insertChunks(theirs.id, theirDocument.id, [CHUNK]);
    const [chunk] = await listUnembeddedChunks(theirs.id, theirDocument.id);

    const written = await setChunkEmbeddings(mine.id, theirDocument.id, [
      { id: chunk!.id, embedding: unitVector(3) },
    ]);

    expect(written).toBe(0);
    expect(
      await listUnembeddedChunks(theirs.id, theirDocument.id),
    ).toHaveLength(1);
  });

  it("writes only the named document's chunks when handed a mixture", async () => {
    // One statement writes the whole batch, so the ownership filter is the only
    // thing stopping `WHERE id = v.id` matching another document's chunk.
    const workspace = await createTestWorkspace(db);
    const [mine, other] = await Promise.all([
      seedDocument(workspace.id, "mine.pdf"),
      seedDocument(workspace.id, "other.pdf"),
    ]);
    await insertChunks(workspace.id, mine.id, [CHUNK]);
    await insertChunks(workspace.id, other.id, [CHUNK]);

    const [ours] = await listUnembeddedChunks(workspace.id, mine.id);
    const [theirs] = await listUnembeddedChunks(workspace.id, other.id);

    const written = await setChunkEmbeddings(workspace.id, mine.id, [
      { id: ours!.id, embedding: unitVector(0) },
      { id: theirs!.id, embedding: unitVector(1) },
    ]);

    expect(written).toBe(1);
    expect(await listUnembeddedChunks(workspace.id, mine.id)).toHaveLength(0);
    expect(await listUnembeddedChunks(workspace.id, other.id)).toHaveLength(1);
  });
});

describe("stale processing watchdog", () => {
  it("fails documents abandoned mid-processing", async () => {
    // `after()` dies with its serverless invocation, so a timeout leaves a
    // document in `processing` with nothing left running to finish it.
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);

    await db
      .update(documents)
      .set({
        status: "processing",
        updatedAt: new Date(Date.now() - 60 * 60_000),
      })
      .where(eq(documents.id, document.id));

    await failStaleProcessing();

    const after = await findDocumentInWorkspace(workspace.id, document.id);
    expect(after!.status).toBe("failed");
    expect(after!.error).toMatch(/stopped unexpectedly/i);
  });

  it("leaves recently-updated processing documents alone", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await seedDocument(workspace.id);
    await updateDocument(workspace.id, document.id, { status: "processing" });

    await failStaleProcessing();

    const after = await findDocumentInWorkspace(workspace.id, document.id);
    expect(after!.status).toBe("processing");
  });
});

describe("account erasure", () => {
  it("removes the entire graph belonging to a user", async () => {
    const user = await createTestUser(db, "erasure-subject");
    const workspace = await createTestWorkspace(db, {
      ownerId: user.id,
      label: "erasure-workspace",
    });
    const document = await seedDocument(workspace.id);
    await insertChunks(workspace.id, document.id, [CHUNK]);

    expect(await deleteUserAccount(user.id)).toBe(true);

    // Documents and chunks go with the workspace, which goes with the user.
    expect(await findDocumentInWorkspace(workspace.id, document.id)).toBeNull();
    const remainingChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id));
    expect(remainingChunks).toHaveLength(0);
  });

  it("leaves other users' data completely untouched", async () => {
    // The assertion that makes erasure safe to ship: deleting one account must
    // not be a cascade that reaches sideways.
    const [alice, bob] = await Promise.all([
      createTestUser(db, "alice"),
      createTestUser(db, "bob"),
    ]);
    const [aliceWorkspace, bobWorkspace] = await Promise.all([
      createTestWorkspace(db, { ownerId: alice.id, label: "alice-ws" }),
      createTestWorkspace(db, { ownerId: bob.id, label: "bob-ws" }),
    ]);
    const bobDocument = await seedDocument(bobWorkspace.id, "bob.pdf");
    await insertChunks(bobWorkspace.id, bobDocument.id, [CHUNK]);

    await deleteUserAccount(alice.id);

    expect(await listDocuments(aliceWorkspace.id)).toHaveLength(0);
    expect(await listDocuments(bobWorkspace.id)).toHaveLength(1);
    expect(await countChunks(bobWorkspace.id, bobDocument.id)).toBe(1);
  });

  it("reports whether an account existed", async () => {
    expect(
      await deleteUserAccount("00000000-0000-0000-0000-000000000000"),
    ).toBe(false);
  });
});
