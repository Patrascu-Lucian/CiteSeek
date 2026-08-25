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
  createChatUnless,
  deleteChat,
  deleteFromTurn,
  deleteTurn,
  getOrCreateChat,
  listChatMessages,
  listChats,
  loadLatestChat,
  renameChat,
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

describe("listChats", () => {
  it("returns nothing for a user with no conversations", async () => {
    const user = await createTestUser(db, "empty");
    const workspace = await createTestWorkspace(db, {
      ownerId: user.id,
      label: "empty-ws",
    });

    expect(await listChats(workspace.id, user.id)).toEqual([]);
  });

  it("summarizes each conversation with its title and message count", async () => {
    const { user, workspace, chat } = await scenario("list");
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "When is reimbursement paid?" },
      { role: "assistant", content: "Within 30 days.", citations: [CITATION] },
    ]);

    const [summary] = await listChats(workspace.id, user.id);

    expect(summary).toMatchObject({
      id: chat.id,
      title: "When is reimbursement paid?",
      messageCount: 2,
    });
  });

  it("counts an empty conversation as zero rather than dropping it", async () => {
    // A LEFT JOIN, not an inner one: a chat that was started and never used is
    // still a chat, and a list that hides it would leave a row nobody can reach
    // or delete.
    const { workspace, user, chat } = await scenario("empty-chat");

    const summaries = await listChats(workspace.id, user.id);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: chat.id, messageCount: 0 });
  });

  it("orders by most recently used, not most recently created", async () => {
    const { user, workspace, chat: first } = await scenario("order");
    const second = await db
      .insert(chats)
      .values({ workspaceId: workspace.id, userId: user.id })
      .returning({ id: chats.id });

    // Touching the older conversation must lift it above the newer one — that is
    // what makes the list read as "where was I?" rather than "what did I start?"
    await appendMessages(workspace.id, user.id, first.id, [
      { role: "user", content: "Back to the first thread." },
    ]);

    const order = (await listChats(workspace.id, user.id)).map((c) => c.id);

    expect(order[0]).toBe(first.id);
    expect(order[1]).toBe(second[0]!.id);
  });

  it("never returns another user's conversations in a shared workspace", async () => {
    // The property the second scope exists for. A workspace can be shared — the
    // demo is readable by every guest — so scoping a chat to its workspace alone
    // would hand one reader another's transcript.
    const { user, workspace } = await scenario("mine");
    const other = await createTestUser(db, "other");
    await db
      .insert(chats)
      .values({ workspaceId: workspace.id, userId: other.id });

    const mine = await listChats(workspace.id, user.id);
    const theirs = await listChats(workspace.id, other.id);

    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(1);
    expect(mine[0]!.id).not.toBe(theirs[0]!.id);
  });
});

describe("renameChat", () => {
  it("renames a conversation the user owns", async () => {
    const { user, workspace, chat } = await scenario("rename");

    expect(
      await renameChat(workspace.id, user.id, chat.id, "  Expenses   policy  "),
    ).toBe(true);

    const [summary] = await listChats(workspace.id, user.id);
    expect(summary!.title).toBe("Expenses policy");
  });

  it("holds a renamed title against the next question asked", async () => {
    // `appendMessages` titles a chat from its first question, but only while the
    // title is null. A rename must not be undone by continuing the conversation.
    const { user, workspace, chat } = await scenario("rename-sticks");
    await renameChat(workspace.id, user.id, chat.id, "Chosen by hand");

    await appendMessages(workspace.id, user.id, chat.id, [
      {
        role: "user",
        content: "A question that would otherwise become a title",
      },
    ]);

    const [summary] = await listChats(workspace.id, user.id);
    expect(summary!.title).toBe("Chosen by hand");
  });

  it("clears the title when given an empty one", async () => {
    const { user, workspace, chat } = await scenario("rename-clear");
    await renameChat(workspace.id, user.id, chat.id, "Something");

    expect(await renameChat(workspace.id, user.id, chat.id, "   ")).toBe(true);

    const [summary] = await listChats(workspace.id, user.id);
    expect(summary!.title).toBeNull();
  });

  it("caps a long title at the same limit auto-titling uses", async () => {
    const { user, workspace, chat } = await scenario("rename-long");

    await renameChat(workspace.id, user.id, chat.id, "x".repeat(500));

    const [summary] = await listChats(workspace.id, user.id);
    expect(summary!.title!.length).toBe(MAX_TITLE_LENGTH);
  });

  it("refuses to rename another user's conversation", async () => {
    const { workspace, chat } = await scenario("rename-theirs");
    const stranger = await createTestUser(db, "stranger");

    expect(
      await renameChat(workspace.id, stranger.id, chat.id, "Hijacked"),
    ).toBe(false);
  });
});

describe("deleteChat", () => {
  it("deletes a conversation and its messages", async () => {
    const { user, workspace, chat } = await scenario("delete");
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Ask" },
      { role: "assistant", content: "Answer" },
    ]);

    expect(await deleteChat(workspace.id, user.id, chat.id)).toBe(true);

    expect(await listChats(workspace.id, user.id)).toEqual([]);
    // The messages go through the foreign key's cascade, not a second statement:
    // nothing in application code walks the tree, so no path can forget a child.
    const orphans = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chat.id));
    expect(orphans).toEqual([]);
  });

  it("refuses to delete another user's conversation", async () => {
    const { user, workspace, chat } = await scenario("delete-theirs");
    const stranger = await createTestUser(db, "delete-stranger");

    expect(await deleteChat(workspace.id, stranger.id, chat.id)).toBe(false);
    expect(await listChats(workspace.id, user.id)).toHaveLength(1);
  });

  it("reports false for a chat that does not exist", async () => {
    const { workspace, user } = await scenario("delete-missing");

    expect(
      await deleteChat(
        workspace.id,
        user.id,
        "00000000-0000-4000-8000-00000000dead",
      ),
    ).toBe(false);
  });
});

describe("admitting a conversation against the cap", () => {
  it("lets exactly the cap through when the form is submitted twice", async () => {
    const user = await createTestUser(db, "chat-race");
    const workspace = await createTestWorkspace(db, {
      ownerId: user.id,
      label: "chat-race-ws",
    });
    const limit = 3;

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        createChatUnless(workspace.id, user.id, (existing) =>
          existing >= limit ? "capped" : null,
        ),
      ),
    );

    expect(results.filter((result) => result.admitted)).toHaveLength(limit);

    const stored = await db
      .select()
      .from(chats)
      .where(eq(chats.workspaceId, workspace.id));
    expect(stored).toHaveLength(limit);
  });

  it("counts this reader's conversations, not the workspace's", async () => {
    // The lock is on the workspace row, which two readers share. The count it
    // guards must still be per reader, or one would cap the other.
    const owner = await createTestUser(db, "chat-scope-owner");
    const workspace = await createTestWorkspace(db, { ownerId: owner.id });
    const other = await createTestUser(db, "chat-scope-other");

    await createChatUnless(workspace.id, owner.id, () => null);

    const forOther = await createChatUnless(
      workspace.id,
      other.id,
      (existing) => (existing >= 1 ? "capped" : null),
    );

    expect(forOther.admitted).toBe(true);
  });
});

describe("deleteTurn", () => {
  /** Two exchanges, oldest first, returned with the ids the caller would name. */
  async function twoTurns() {
    const { user, workspace, chat } = await scenario("turns");

    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer", citations: [CITATION] },
    ]);
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Second question" },
      { role: "assistant", content: "Second answer" },
    ]);

    const stored = await listChatMessages(workspace.id, user.id, chat.id);
    return { user, workspace, chat, stored };
  }

  it("takes the answer with the question", async () => {
    const { user, workspace, chat, stored } = await twoTurns();

    expect(
      await deleteTurn(workspace.id, user.id, chat.id, stored[0]!.id),
    ).toBe(2);

    expect(
      (await listChatMessages(workspace.id, user.id, chat.id)).map(
        (message) => message.content,
      ),
    ).toEqual(["Second question", "Second answer"]);
  });

  it("stops at the next question rather than truncating the rest", async () => {
    // A middle turn goes on its own. Deleting to the end would be a different
    // feature, and the one editing needs.
    const { user, workspace, chat, stored } = await twoTurns();

    await deleteTurn(workspace.id, user.id, chat.id, stored[0]!.id);
    const left = await listChatMessages(workspace.id, user.id, chat.id);

    expect(left).toHaveLength(2);
    expect(left[0]!.position).toBe(2);
  });

  it("refuses an answer's id, since a turn is named by its question", async () => {
    const { user, workspace, chat, stored } = await twoTurns();

    expect(
      await deleteTurn(workspace.id, user.id, chat.id, stored[1]!.id),
    ).toBe(0);
    expect(await listChatMessages(workspace.id, user.id, chat.id)).toHaveLength(
      4,
    );
  });

  it("leaves the gap rather than renumbering what follows", async () => {
    // `appendMessages` takes the maximum, so a gap costs nothing — and
    // renumbering would race the unique index on (chat_id, position).
    const { user, workspace, chat, stored } = await twoTurns();

    await deleteTurn(workspace.id, user.id, chat.id, stored[0]!.id);
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Third question" },
    ]);

    const left = await listChatMessages(workspace.id, user.id, chat.id);
    expect(left.map((message) => message.position)).toEqual([2, 3, 4]);
  });

  it("cannot reach another workspace's conversation", async () => {
    const { chat, stored } = await twoTurns();
    const other = await scenario("turns-other");

    expect(
      await deleteTurn(
        other.workspace.id,
        other.user.id,
        chat.id,
        stored[0]!.id,
      ),
    ).toBe(0);
  });

  it("cannot reach another user's conversation in a workspace they share", async () => {
    const { workspace, chat, stored } = await twoTurns();
    const stranger = await createTestUser(db, "turns-stranger");

    expect(
      await deleteTurn(workspace.id, stranger.id, chat.id, stored[0]!.id),
    ).toBe(0);
  });

  it("answers zero for a malformed id rather than throwing", async () => {
    const { user, workspace, chat } = await twoTurns();

    expect(await deleteTurn(workspace.id, user.id, chat.id, "not-a-uuid")).toBe(
      0,
    );
  });
});

describe("deleteFromTurn", () => {
  async function threeTurns() {
    const { user, workspace, chat } = await scenario("from-turn");

    for (const n of [1, 2, 3]) {
      await appendMessages(workspace.id, user.id, chat.id, [
        { role: "user", content: `Question ${n}` },
        { role: "assistant", content: `Answer ${n}` },
      ]);
    }

    const stored = await listChatMessages(workspace.id, user.id, chat.id);
    return { user, workspace, chat, stored };
  }

  it("takes everything after the question as well as the turn itself", async () => {
    const { user, workspace, chat, stored } = await threeTurns();

    // From the second question: four rows, not the two `deleteTurn` would take.
    expect(
      await deleteFromTurn(workspace.id, user.id, chat.id, stored[2]!.id),
    ).toBe(4);

    expect(
      (await listChatMessages(workspace.id, user.id, chat.id)).map(
        (message) => message.content,
      ),
    ).toEqual(["Question 1", "Answer 1"]);
  });

  /* The distinction the two functions exist for, asserted against each other so
     a shared implementation cannot quietly collapse them. */
  it("differs from deleteTurn on the same message", async () => {
    const one = await threeTurns();
    const onward = await threeTurns();

    expect(
      await deleteTurn(
        one.workspace.id,
        one.user.id,
        one.chat.id,
        one.stored[2]!.id,
      ),
    ).toBe(2);
    expect(
      await deleteFromTurn(
        onward.workspace.id,
        onward.user.id,
        onward.chat.id,
        onward.stored[2]!.id,
      ),
    ).toBe(4);
  });

  it("refuses an answer's id, as its sibling does", async () => {
    const { user, workspace, chat, stored } = await threeTurns();

    expect(
      await deleteFromTurn(workspace.id, user.id, chat.id, stored[1]!.id),
    ).toBe(0);
  });

  it("cannot reach another user's conversation", async () => {
    const { workspace, chat, stored } = await threeTurns();
    const stranger = await createTestUser(db, "from-turn-stranger");

    expect(
      await deleteFromTurn(workspace.id, stranger.id, chat.id, stored[0]!.id),
    ).toBe(0);
  });

  /* Unlike `deleteTurn`, this one *frees* its numbers rather than leaving a gap:
     `appendMessages` takes `MAX(position) + 1`, and truncating to the end lowers
     the maximum. Deleting from the middle cannot, because a later row still
     holds a higher one. */
  it("reuses the freed positions for the re-asked turn", async () => {
    const { user, workspace, chat, stored } = await threeTurns();

    await deleteFromTurn(workspace.id, user.id, chat.id, stored[2]!.id);
    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "Question 2, reworded" },
      { role: "assistant", content: "Answer 2, again" },
    ]);

    const left = await listChatMessages(workspace.id, user.id, chat.id);
    expect(left.map((message) => message.content)).toEqual([
      "Question 1",
      "Answer 1",
      "Question 2, reworded",
      "Answer 2, again",
    ]);
    expect(left.map((message) => message.position)).toEqual([0, 1, 2, 3]);
  });
});

describe("a client-supplied message id", () => {
  /* The bug this exists for: the SDK mints base62 ids, `messages.id` is a uuid
     column, so a question asked in the current session could not be named to
     `deleteTurn` — editing or deleting it failed until a reload. */
  it("is stored, so the turn can be named straight away", async () => {
    const { user, workspace, chat } = await scenario("client-id");
    const id = "3f1c9b6e-9a2a-4a4a-8a1a-9b2c3d4e5f60";

    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "A question", id },
      { role: "assistant", content: "An answer" },
    ]);

    expect(await deleteTurn(workspace.id, user.id, chat.id, id)).toBe(2);
  });

  it("falls back to a generated one when it is not a uuid", async () => {
    // The SDK's own format, and local mode, which never reaches here at all.
    const { user, workspace, chat } = await scenario("client-id-junk");

    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "A question", id: "kP3xQ9mZ" },
    ]);

    const [stored] = await listChatMessages(workspace.id, user.id, chat.id);
    expect(stored!.id).not.toBe("kP3xQ9mZ");
    expect(stored!.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("a client id that was already stored", () => {
  /* Regenerate re-sends the turn with the id it minted the first time, and the
     route persists on Stop too — so the second insert collides on the primary
     key. It threw: a 500 on the refusal branch, and on the answer branch a turn
     the reader watched arrive that was never written down. */
  it("keeps the turn rather than failing on the collision", async () => {
    const user = await createTestUser(db, "repeat");
    const workspace = await createTestWorkspace(db, { ownerId: user.id });
    const chat = await getOrCreateChat(workspace.id, user.id);
    const id = "11111111-2222-4333-8444-555555555555";

    for (const answer of ["An answer", "Another answer"]) {
      await appendMessages(workspace.id, user.id, chat.id, [
        { role: "user", content: "A question", id },
        { role: "assistant", content: answer },
      ]);
    }

    const stored = await listChatMessages(workspace.id, user.id, chat.id);

    expect(stored.map((one) => one.content)).toEqual([
      "A question",
      "An answer",
      "A question",
      "Another answer",
    ]);
    // The first keeps the name; the second falls back rather than colliding.
    expect(stored.filter((one) => one.id === id)).toHaveLength(1);
  });
});
