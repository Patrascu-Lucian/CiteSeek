import type { Metadata } from "next";

import { ChatSection } from "@/components/workspace/chat-section";
import { loadLatestChat } from "@/lib/chats/queries";
import { toUIMessages } from "@/lib/chats/to-ui-messages";
import { requireWorkspace } from "@/lib/workspaces/require-workspace";

import { messageCapFor } from "./message-cap";

export const metadata: Metadata = { title: "Workspace" };

/** The workspace, opened on whichever conversation was used last. */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { workspace, writable, signedIn, userId } =
    await requireWorkspace(workspaceId);

  const openChat =
    writable && userId ? await loadLatestChat(workspace.id, userId) : null;

  return (
    <ChatSection
      workspaceId={workspace.id}
      activeChatId={openChat?.chatId ?? null}
      initialMessages={openChat ? toUIMessages(openChat.messages) : []}
      signedIn={signedIn}
      isDemo={workspace.isDemo}
      canWrite={writable}
      messageCap={
        openChat && userId
          ? await messageCapFor(workspace.id, userId, openChat.messages.length)
          : null
      }
    />
  );
}
