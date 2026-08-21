import { countChats } from "@/lib/chats/queries";
import { capRefusalCopy, type CapCopy } from "@/lib/limits/caps";
import { resolvePlanLimits } from "@/lib/limits/config";

/** Before the reader types, not after: the route refuses with the question
 * already written, and loses it. */
export async function messageCapFor(
  workspaceId: string,
  userId: string,
  messageCount: number,
): Promise<CapCopy | null> {
  const limits = resolvePlanLimits();

  if (messageCount < limits.messagesPerConversation) return null;

  return capRefusalCopy(
    {
      allowed: false,
      reason: "cap_reached",
      cap: "messages",
      limit: limits.messagesPerConversation,
      current: messageCount,
    },
    // "Start a new conversation" is wrong advice for a reader who has used all
    // of theirs.
    {
      conversationsExhausted:
        (await countChats(workspaceId, userId)) >= limits.conversations,
    },
  );
}
