import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  type MessageCitation,
  type RefusalReason,
  chats,
  messages,
} from "@/lib/db/schema";

import { MAX_TITLE_LENGTH, titleFromQuestion } from "./titles";

// Defined in `titles.ts` because a client component needs the limit and must not
// pull the database in with it.
export { MAX_TITLE_LENGTH, titleFromQuestion };

/**
 * Every read and write of chat data.
 *
 * Two scopes, not one: a workspace can be shared, so `workspaceId` alone would
 * let one reader load another's conversation. Every query filters on
 * `workspaceId` **and** `userId`; messages reach both by joining through their
 * chat. Signed-in users only (ADR 013).
 */

/** Most recent, or a new one — creating per request would make every reload start
 * a fresh conversation. */
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

/** Oldest first, scoped through the chat's workspace and user: an id is
 * guessable, ownership is the thing to check. */
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

/** The client says which conversation, so the id is checked against this
 * workspace and user. A mismatch falls back to the most recent rather than
 * erroring — a stale id should not lose the reader's question. */
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

/** Scoped by workspace *and* user, matching `createChat` — a count taken on the
 * workspace alone would cap a shared workspace collectively. The conversation
 * cap reads this. */
export async function countChats(
  workspaceId: string,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(chats)
    .where(and(eq(chats.workspaceId, workspaceId), eq(chats.userId, userId)));

  return row?.total ?? 0;
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
 * Newest first. LEFT JOIN with a grouped count, not a correlated subquery — see
 * `listDocuments` for why that silently returns zero. Ordered by `updatedAt`, so
 * "most recent" means most recently *used*.
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
 * Returns whether a row changed, so a caller distinguishes "not yours" from
 * "done" without a second query. Scoped on chat, workspace *and* user: read
 * access to a shared workspace must not imply write access inside it.
 *
 * An empty title clears it, returning the chat to being described by its first
 * question.
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

/** Messages go with it through `ON DELETE CASCADE`. No application code walks the
 * tree, so no path can forget a child. */
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
 * Verifies ownership before writing — otherwise a guessed id appends to someone
 * else's conversation.
 *
 * Citations are stored as the **full numbered list in marker order**, so `[n]`
 * resolves to `citations[n - 1]` both while streaming and after a reload. Storing
 * only the cited subset would renumber and repoint every marker.
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

  // Ordering cannot use `createdAt`: it is the transaction timestamp, so both
  // rows of a turn share it and the tiebreak falls to a random UUID.
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
      // `now()`, not a JS Date: the column defaults to the database clock, and
      // mixing two machines' clocks lets an update predate its own insert.
      updatedAt: sql`now()`,
      ...(owned.title === null && firstQuestion
        ? { title: titleFromQuestion(firstQuestion) }
        : {}),
    })
    .where(eq(chats.id, chatId));

  return inserted.length;
}
