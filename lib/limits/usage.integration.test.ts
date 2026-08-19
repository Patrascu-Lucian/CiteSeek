import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createChat } from "@/lib/chats/queries";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";
import { createQueuedDocument, updateDocument } from "@/lib/documents/queries";

import { DEFAULT_PLAN_LIMITS } from "./config";
import { planUsage } from "./usage";

/**
 * The meter and the refusal read the same rows through different helpers, so the
 * failure to guard against is them disagreeing — a ceiling that says two of three
 * while the upload is refused is worse than showing nothing.
 */

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

async function readyDocument(workspaceId: string, characters: number) {
  const document = await createQueuedDocument(workspaceId, {
    filename: "handbook.md",
    mimeType: "text/markdown",
    sizeBytes: 1024,
  });

  await updateDocument(workspaceId, document.id, {
    status: "ready",
    contentText: "x".repeat(characters),
  });
}

describe("planUsage", () => {
  it("reports nothing used in a fresh workspace", async () => {
    const user = await createTestUser(db);
    const workspace = await createTestWorkspace(db, { ownerId: user.id });

    await expect(planUsage(workspace.id, user.id)).resolves.toMatchObject({
      documents: { used: 0, limit: DEFAULT_PLAN_LIMITS.documents },
      conversations: { used: 0, limit: DEFAULT_PLAN_LIMITS.conversations },
      storage: { used: 0, limit: DEFAULT_PLAN_LIMITS.extractedCharacters },
    });
  });

  it("counts documents whatever their status, as the cap does", async () => {
    const user = await createTestUser(db);
    const workspace = await createTestWorkspace(db, { ownerId: user.id });

    await readyDocument(workspace.id, 500);
    // Queued, never extracted: it occupies a slot and no characters.
    await createQueuedDocument(workspace.id, {
      filename: "pending.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    });

    const usage = await planUsage(workspace.id, user.id);

    expect(usage.documents.used).toBe(2);
    expect(usage.storage.used).toBe(500);
  });

  /* Conversations are per reader and documents per workspace. Counting either on
     the wrong scope would put the meter and the refusal on different numbers. */
  it("counts only this reader's conversations", async () => {
    const owner = await createTestUser(db, "owner");
    const other = await createTestUser(db, "other");
    const workspace = await createTestWorkspace(db, { ownerId: owner.id });

    await createChat(workspace.id, owner.id);
    await createChat(workspace.id, other.id);

    await expect(planUsage(workspace.id, owner.id)).resolves.toMatchObject({
      conversations: { used: 1 },
    });
  });

  it("counts no other workspace's documents", async () => {
    const user = await createTestUser(db);
    const mine = await createTestWorkspace(db, { ownerId: user.id });
    const theirs = await createTestWorkspace(db, { ownerId: user.id });

    await readyDocument(theirs.id, 900);

    await expect(planUsage(mine.id, user.id)).resolves.toMatchObject({
      documents: { used: 0 },
      storage: { used: 0 },
    });
  });
});
