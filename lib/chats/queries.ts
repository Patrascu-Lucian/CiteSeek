import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { type MessageCitation, chats, messages } from "@/lib/db/schema";

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

/** Chat titles are derived from the first question; longer ones are cut here. */
export const MAX_TITLE_LENGTH = 80;

export function titleFromQuestion(question: string): string {
  const collapsed = question.replace(/\s+/g, " ").trim();

  return collapsed.length <= MAX_TITLE_LENGTH
    ? collapsed
    : `${collapsed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

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

export type NewChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: MessageCitation[];
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
