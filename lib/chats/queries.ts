import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  type MessageCitation,
  type RefusalReason,
  chats,
  messages,
} from "@/lib/db/schema";

import { MAX_TITLE_LENGTH, titleFromQuestion } from "./titles";

// Re-exported so existing callers and tests keep one import site for chat
// concerns; the definitions live in `titles.ts` because a client component needs
// the limit and must not pull the database in with it.
export { MAX_TITLE_LENGTH, titleFromQuestion };

/**
 * Every read and write of chat data.
 *
 * Same rule as `lib/documents/queries.ts`: each function takes the scope it needs
 * and filters on it **in SQL**, so there is no helper here capable of returning
 * another tenant's rows.
 *
 * Chats carry a second scope that documents do not. A workspace can be shared —
 * the demo workspace is readable by every guest — so scoping a chat to its
 * workspace alone would let one reader load another's conversation. Every query
 * below filters on `workspaceId` **and** `userId`, and messages reach both by
 * joining through their chat rather than trusting a chat id a caller supplied.
 *
 * Only signed-in users get persistence (ADR 013). Guest conversations live in
 * browser state, which keeps an unbounded write path off a public URL.
 */

/**
 * The user's most recent chat in a workspace, or a new one.
 *
 * Milestone 2 gives each user a single running conversation per workspace;
 * Milestone 4 adds the history UI that makes more than one addressable. Picking
 * the most recent rather than creating one per request is what makes a reload
 * continue the conversation instead of starting a fresh one.
 */
export async function getOrCreateChat(
  workspaceId: string,
  userId: string,
): Promise<{ id: string }> {
  const [existing] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.workspaceId, workspaceId), eq(chats.userId, userId)))
    .orderBy(desc(chats.updatedAt))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(chats)
    .values({ workspaceId, userId })
    .returning({ id: chats.id });

  return created!;
}

export type ChatMessage = {
  id: string;
  position: number;
  role: "user" | "assistant";
  content: string;
  citations: MessageCitation[];
  /** Non-null only when the turn could not be grounded. See ADR 017. */
  refusalReason: RefusalReason | null;
  createdAt: Date;
};

/**
 * A conversation, oldest first.
 *
 * Scoped through the chat's own workspace and user rather than by chat id alone:
 * an id is guessable, and ownership is the thing that must be checked.
 */
export async function listChatMessages(
  workspaceId: string,
  userId: string,
  chatId: string,
): Promise<ChatMessage[]> {
  return db
    .select({
      id: messages.id,
      position: messages.position,
      role: messages.role,
      content: messages.content,
      citations: messages.citations,
      refusalReason: messages.refusalReason,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .where(
      and(
        eq(messages.chatId, chatId),
        eq(chats.workspaceId, workspaceId),
        eq(chats.userId, userId),
      ),
    )
    .orderBy(asc(messages.position));
}

/** The user's latest conversation in a workspace, ready to render. */
export async function loadLatestChat(
  workspaceId: string,
  userId: string,
): Promise<{ chatId: string; messages: ChatMessage[] } | null> {
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.workspaceId, workspaceId), eq(chats.userId, userId)))
    .orderBy(desc(chats.updatedAt))
    .limit(1);

  if (!chat) return null;

  return {
    chatId: chat.id,
    messages: await listChatMessages(workspaceId, userId, chat.id),
  };
}

/**
 * Resolves which conversation a turn belongs to.
 *
 * With history, the reader can be looking at any of their conversations, so the
 * client says which one — but a client-supplied id is exactly what must not be
 * trusted. The id is checked against this workspace *and* this user before it is
 * used; anything that does not match falls back to the most recent conversation
 * rather than erroring, because a stale id from a deleted chat should continue
 * the reader somewhere sensible instead of losing their question.
 */
export async function resolveChatForTurn(
  workspaceId: string,
  userId: string,
  requestedChatId: string | null,
): Promise<{ id: string }> {
  if (requestedChatId) {
    const [owned] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(
        and(
          eq(chats.id, requestedChatId),
          eq(chats.workspaceId, workspaceId),
          eq(chats.userId, userId),
        ),
      )
      .limit(1);

    if (owned) return owned;
  }

  return getOrCreateChat(workspaceId, userId);
}

/** Starts an empty conversation, so "New conversation" has something to open. */
export async function createChat(
  workspaceId: string,
  userId: string,
): Promise<{ id: string }> {
  const [created] = await db
    .insert(chats)
    .values({ workspaceId, userId })
    .returning({ id: chats.id });

  return created!;
}

export type ChatSummary = {
  id: string;
  title: string | null;
  updatedAt: Date;
  messageCount: number;
};

/**
 * Every conversation this user has in this workspace, newest first.
 *
 * A LEFT JOIN with a grouped count rather than a correlated subquery, for the
 * reason `listDocuments` records: inside a `sql` template Drizzle emits column
 * references unqualified, so a correlated `WHERE` compares a table to itself and
 * silently returns zero. A join forces qualification.
 *
 * Ordered by `updatedAt` so a conversation returns to the top when it is added
 * to, which is what makes "most recent" mean "most recently used" rather than
 * "most recently created".
 */
export async function listChats(
  workspaceId: string,
  userId: string,
): Promise<ChatSummary[]> {
  return db
    .select({
      id: chats.id,
      title: chats.title,
      updatedAt: chats.updatedAt,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
    .from(chats)
    .leftJoin(messages, eq(messages.chatId, chats.id))
    .where(and(eq(chats.workspaceId, workspaceId), eq(chats.userId, userId)))
    .groupBy(chats.id)
    .orderBy(desc(chats.updatedAt));
}

/**
 * Renames a conversation.
 *
 * Returns whether a row was changed, so a caller can tell "not yours" from
 * "done" without a second query. Scoped on all three of chat, workspace and
 * user: a chat id is a guessable UUID and read access to a shared workspace must
 * not imply write access to someone else's conversation inside it.
 *
 * Reuses `MAX_TITLE_LENGTH` rather than inventing a second limit, so a renamed
 * chat and an auto-titled one cannot disagree about how long a title may be.
 * An empty title clears it, which returns the chat to being described by its
 * first question — a rename box is not the place to enforce that a chat must
 * have a name.
 */
export async function renameChat(
  workspaceId: string,
  userId: string,
  chatId: string,
  title: string,
): Promise<boolean> {
  const trimmed = title.replace(/\s+/g, " ").trim();

  const updated = await db
    .update(chats)
    .set({
      title: trimmed.length === 0 ? null : trimmed.slice(0, MAX_TITLE_LENGTH),
    })
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.workspaceId, workspaceId),
        eq(chats.userId, userId),
      ),
    )
    .returning({ id: chats.id });

  return updated.length > 0;
}

/**
 * Deletes a conversation and everything in it.
 *
 * The messages go with it through `ON DELETE CASCADE` on the foreign key rather
 * than a second statement here — the same reason account deletion is one
 * statement. Nothing in application code walks the tree, so no code path can
 * forget a child.
 */
export async function deleteChat(
  workspaceId: string,
  userId: string,
  chatId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.workspaceId, workspaceId),
        eq(chats.userId, userId),
      ),
    )
    .returning({ id: chats.id });

  return deleted.length > 0;
}

export type NewChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: MessageCitation[];
  /** Set on an assistant turn that could not be grounded. */
  refusalReason?: RefusalReason | null;
};

/**
 * Appends a turn to a conversation.
 *
 * Verifies the chat belongs to this user in this workspace before writing
 * anything — without that check a caller could append to someone else's
 * conversation by guessing an id, the same hole `insertChunks` closes for
 * documents.
 *
 * Citations are stored as the **full numbered source list in marker order**, so
 * `[n]` resolves to `citations[n - 1]` identically while streaming and after a
 * reload. Storing only the passages the model happened to cite would renumber
 * them and silently repoint every marker.
 */
export async function appendMessages(
  workspaceId: string,
  userId: string,
  chatId: string,
  rows: readonly NewChatMessage[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const [owned] = await db
    .select({ id: chats.id, title: chats.title })
    .from(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.workspaceId, workspaceId),
        eq(chats.userId, userId),
      ),
    )
    .limit(1);

  if (!owned) return 0;

  // Positions continue from what is already stored. Ordering cannot rely on
  // `createdAt`: it defaults to `now()`, the *transaction* timestamp, so both
  // rows of one turn share it exactly and the tiebreak falls to a random UUID.
  const [last] = await db
    .select({ position: messages.position })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.position))
    .limit(1);

  const nextPosition = (last?.position ?? -1) + 1;

  const inserted = await db
    .insert(messages)
    .values(
      rows.map((row, index) => ({
        chatId,
        position: nextPosition + index,
        role: row.role,
        content: row.content,
        citations: row.citations ?? [],
        refusalReason: row.refusalReason ?? null,
      })),
    )
    .returning({ id: messages.id });

  // A chat with no title yet takes it from the first question asked in it.
  const firstQuestion = rows.find((row) => row.role === "user")?.content;

  await db
    .update(chats)
    .set({
      // `now()` rather than a JavaScript Date: `createdAt` defaults to the
      // database's clock, and mixing two machines' clocks in one column lets an
      // update write a timestamp earlier than the insert it follows. Chats are
      // ordered by this column, so it must not move backwards.
      updatedAt: sql`now()`,
      ...(owned.title === null && firstQuestion
        ? { title: titleFromQuestion(firstQuestion) }
        : {}),
    })
    .where(eq(chats.id, chatId));

  return inserted.length;
}
