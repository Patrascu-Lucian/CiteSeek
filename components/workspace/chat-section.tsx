"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { ChatPanel } from "@/components/chat/chat-panel";
import type { ChatUIMessage } from "@/lib/ai/types";
import type { CapCopy } from "@/lib/limits/caps";

import { useWorkspaceShell } from "./workspace-shell-context";

/** The only per-route part of the workspace, which is what lets the shell above
 * it survive a conversation change (ADR 041). */
export function ChatSection({
  workspaceId,
  activeChatId,
  initialMessages,
  signedIn,
  isDemo,
  canWrite,
  messageCap,
}: {
  workspaceId: string;
  activeChatId: string | null;
  initialMessages: ChatUIMessage[];
  signedIn: boolean;
  isDemo: boolean;
  canWrite: boolean;
  messageCap: CapCopy | null;
}) {
  const router = useRouter();
  const { hasReadyDocuments, readyFilenames, openSource, openChunkId } =
    useWorkspaceShell();

  // Reaches the layout too, which is what keeps the conversation list current.
  const refreshFromServer = useCallback(() => router.refresh(), [router]);

  return (
    <section aria-labelledby="chat-heading" className="mt-12 space-y-4">
      <h2 id="chat-heading" className="text-lg font-medium">
        Ask
      </h2>

      <ChatPanel
        // Keyed, not synced: `useChat` seeds from `initialMessages` once, so
        // deleting the last conversation left its messages on screen.
        key={activeChatId ?? "none"}
        workspaceId={workspaceId}
        chatId={activeChatId}
        hasReadyDocuments={hasReadyDocuments}
        signedIn={signedIn}
        isDemo={isDemo}
        onOpenSource={openSource}
        openChunkId={openChunkId}
        initialMessages={initialMessages}
        messageCap={messageCap}
        canUpload={canWrite}
        canDelete={canWrite && signedIn}
        documents={readyFilenames}
        // A guest's turns are never written down, so nothing goes stale.
        onTurnComplete={signedIn ? refreshFromServer : undefined}
      />
    </section>
  );
}
