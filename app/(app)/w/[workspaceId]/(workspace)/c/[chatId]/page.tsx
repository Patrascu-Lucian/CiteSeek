import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatSection } from "@/components/workspace/chat-section";
import { chatExists, listChatMessages } from "@/lib/chats/queries";
import { toUIMessages } from "@/lib/chats/to-ui-messages";
import { requireWorkspace } from "@/lib/workspaces/require-workspace";

import { messageCapFor } from "../../message-cap";

export const metadata: Metadata = { title: "Conversation" };

/** One named conversation. Its own URL is what lets the history list be
 * destinations rather than a widget holding client state. */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; chatId: string }>;
}) {
  const { workspaceId, chatId } = await params;
  const { workspace, writable, signedIn, userId } =
    await requireWorkspace(workspaceId);

  // Nothing is stored for a guest (ADR 013) or where nobody may write (ADR 040).
  if (!writable || !userId) notFound();

  const messages = await listChatMessages(workspace.id, userId, chatId);

  // 404 rather than falling back to the latest, or a deleted conversation would
  // look like it still existed.
  if (
    messages.length === 0 &&
    !(await chatExists(workspace.id, userId, chatId))
  ) {
    notFound();
  }

  return (
    <ChatSection
      workspaceId={workspace.id}
      activeChatId={chatId}
      initialMessages={toUIMessages(messages)}
      signedIn={signedIn}
      isDemo={workspace.isDemo}
      canWrite={writable}
      messageCap={await messageCapFor(workspace.id, userId, messages.length)}
    />
  );
}
