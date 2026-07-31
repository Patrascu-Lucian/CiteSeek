import type { Metadata } from "next";

import { WorkspaceView } from "../../workspace-view";

export const metadata: Metadata = { title: "Conversation" };

/**
 * One named conversation.
 *
 * Same view as the workspace root, opened on a specific chat. Having its own URL
 * is what makes a conversation linkable, bookmarkable and reachable with the
 * back button — and what lets the history list be a list of destinations rather
 * than a widget holding client state.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; chatId: string }>;
}) {
  const { workspaceId, chatId } = await params;

  return <WorkspaceView workspaceId={workspaceId} chatId={chatId} />;
}
