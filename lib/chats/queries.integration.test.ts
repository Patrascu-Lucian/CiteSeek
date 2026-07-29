import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type MessageCitation, chats, messages } from "@/lib/db/schema";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";
import { deleteUserAccount } from "@/lib/users/deletion";

import {
  MAX_TITLE_LENGTH,
  appendMessages,
  getOrCreateChat,
  listChatMessages,
  loadLatestChat,
  titleFromQuestion,
} from "./queries";

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

const CITATION: MessageCitation = {
  chunkId: "00000000-0000-4000-8000-000000000001",
  documentId: "00000000-0000-4000-8000-000000000002",
  filename: "handbook.pdf",
  pageNumber: 3,
  charStart: 0,
  charEnd: 38,
  quote: "Expenses are reimbursed within 30 days.",
};

async function scenario(label = "owner") {
  const user = await createTestUser(db, label);
  const workspace = await createTestWorkspace(db, {
    ownerId: user.id,
    label: `${label}-ws`,
  });
  const chat = await getOrCreateChat(workspace.id, user.id);

  return { user, workspace, chat };
}

describe("getOrCreateChat", () => {
  it("creates a chat the first time and reuses it after", async () => {
    const { workspace, user, chat } = await scenario();

    const again = await getOrCreateChat(workspace.id, user.id);

    // Milestone 2 gives each user one running conversation per workspace, so a
    // reload continues it rather than starting a fresh one.
    expect(again.id).toBe(chat.id);
  });

  it("gives two users separate chats in the same workspace", async () => {
    // The demo workspace is shared. Scoping a chat to its workspace alone would
    // let one reader load another's conversation.
    const owner = await createTestUser(db, "shared-owner");
    const workspace = await createTestWorkspace(db, { ownerId: owner.id });
    const other = await createTestUser(db, "shared-other");

    const mine = await getOrCreateChat(workspace.id, owner.id);
    const theirs = await getOrCreateChat(workspace.id, other.id);

    expect(mine.id).not.toBe(theirs.id);
  });
});

describe("appendMessages", () => {
  it("stores a turn with its citations", async () => {
    const { workspace, user, chat } = await scenario("stores");

    const written = await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "What is the policy?" },
      {
        role: "assistant",
        content: "Paid in 30 days [1].",
        citations: [CITATION],
      },
    ]);

    expect(written).toBe(2);

    const stored = await listChatMessages(workspace.id, user.id, chat.id);
    expect(stored.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(stored[1]!.citations).toEqual([CITATION]);
  });

  it("stores an empty citation list for a refusal", async () => {
    const { workspace, user, chat } = await scenario("refusal");

    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Unrelated question." },
      { role: "assistant", content: "I couldn't find anything relevant." },
    ]);

    const stored = await listChatMessages(workspace.id, user.id, chat.id);
    // A refusal cites nothing, and the stored transcript has to say so — a
    // reload that invented citations would defeat the whole guarantee.
    expect(stored[1]!.citations).toEqual([]);
  });

  it("titles the chat from the first question only", async () => {
    const { workspace, user, chat } = await scenario("titled");

    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "First question." },
      { role: "assistant", content: "An answer." },
    ]);
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Second question." },
      { role: "assistant", content: "Another answer." },
    ]);

    const [row] = await db
      .select({ title: chats.title })
      .from(chats)
      .where(eq(chats.id, chat.id));

    expect(row!.title).toBe("First question.");
  });

  it("refuses to append to another user's chat", async () => {
    const mine = await scenario("append-mine");
    const stranger = await createTestUser(db, "append-stranger");

    const written = await appendMessages(
      mine.workspace.id,
      stranger.id,
      mine.chat.id,
      [{ role: "user", content: "Injected." }],
    );

    // Guessing a chat id must not be enough to write to it.
    expect(written).toBe(0);
    expect(
      await listChatMessages(mine.workspace.id, mine.user.id, mine.chat.id),
    ).toEqual([]);
  });

  it("refuses to append through the wrong workspace", async () => {
    const mine = await scenario("wrong-ws-a");
    const other = await scenario("wrong-ws-b");

    const written = await appendMessages(
      other.workspace.id,
      mine.user.id,
      mine.chat.id,
      [{ role: "user", content: "Injected." }],
    );

    expect(written).toBe(0);
  });
});

describe("listChatMessages", () => {
  it("cannot read another user's conversation", async () => {
    const mine = await scenario("read-mine");
    await appendMessages(mine.workspace.id, mine.user.id, mine.chat.id, [
      { role: "user", content: "Something private." },
    ]);
    const stranger = await createTestUser(db, "read-stranger");

    const leaked = await listChatMessages(
      mine.workspace.id,
      stranger.id,
      mine.chat.id,
    );

    expect(leaked).toEqual([]);
  });

  it("returns messages oldest first", async () => {
    const { workspace, user, chat } = await scenario("ordered");

    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "One" },
      { role: "assistant", content: "Two" },
    ]);
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Three" },
    ]);

    const stored = await listChatMessages(workspace.id, user.id, chat.id);
    expect(stored.map((m) => m.content)).toEqual(["One", "Two", "Three"]);
  });
});

describe("loadLatestChat", () => {
  it("returns null for a user with no conversation", async () => {
    const user = await createTestUser(db, "no-chat");
    const workspace = await createTestWorkspace(db, { ownerId: user.id });

    expect(await loadLatestChat(workspace.id, user.id)).toBeNull();
  });

  it("restores the conversation with its citations intact", async () => {
    const { workspace, user, chat } = await scenario("restore");
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "What is the policy?" },
      {
        role: "assistant",
        content: "Paid in 30 days [1].",
        citations: [CITATION],
      },
    ]);

    const restored = await loadLatestChat(workspace.id, user.id);

    expect(restored!.chatId).toBe(chat.id);
    // The chips have to keep working after a reload, which means the anchors
    // survive the round trip through jsonb unchanged.
    expect(restored!.messages[1]!.citations[0]).toEqual(CITATION);
  });

  it("does not return another user's chat in a shared workspace", async () => {
    const owner = await createTestUser(db, "latest-owner");
    const workspace = await createTestWorkspace(db, { ownerId: owner.id });
    const ownerChat = await getOrCreateChat(workspace.id, owner.id);
    await appendMessages(workspace.id, owner.id, ownerChat.id, [
      { role: "user", content: "Private." },
    ]);

    const other = await createTestUser(db, "latest-other");

    expect(await loadLatestChat(workspace.id, other.id)).toBeNull();
  });
});

describe("deletion", () => {
  it("removes chats and messages with the account", async () => {
    const { workspace, user, chat } = await scenario("deleted");
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Something to erase." },
    ]);

    await deleteUserAccount(user.id);

    // Deletion has to be real, and it cascades through the workspace to its
    // chats and their messages.
    const remainingChats = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.id, chat.id));
    const remainingMessages = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chat.id));

    expect(remainingChats).toEqual([]);
    expect(remainingMessages).toEqual([]);
  });
});

describe("titleFromQuestion", () => {
  it("collapses whitespace", () => {
    expect(titleFromQuestion("  What   is\nthe policy?  ")).toBe(
      "What is the policy?",
    );
  });

  it("truncates a long question with an ellipsis", () => {
    const title = titleFromQuestion("word ".repeat(60));

    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(title.endsWith("…")).toBe(true);
  });

  it("leaves a short question untouched", () => {
    expect(titleFromQuestion("Short one.")).toBe("Short one.");
  });
});
