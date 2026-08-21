import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatTransport } from "ai";
import { MessageSquareOff, Trash2 } from "lucide-react";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";
import { deleteConversationTurn } from "@/lib/chats/actions";
import { type CapCopy, parseCapRefusal } from "@/lib/limits/caps";
import { parseRefusal } from "@/lib/usage/limits";
import { Notice } from "@/components/ui/notice";

import { ChatError } from "./chat-error";
import { Composer } from "./composer";
import { MessageList, warmAnswer } from "./message-list";

/**
 * Owns the conversation. One owner of state, presentational children, no prop
 * copied into state. The draft question is deliberately *not* here — holding it
 * at this level re-rendered the whole transcript on every keystroke.
 */
export function ChatPanel({
  workspaceId,
  hasReadyDocuments,
  signedIn = false,
  initialMessages = [],
  onTurnComplete,
  documents = [],
  canUpload = false,
  isDemo = false,
  onOpenSource,
  openChunkId,
  chatId = null,
  messageCap = null,
  canDelete = false,
  transport,
  uploadHref,
}: {
  workspaceId: string;
  /** Which conversation the turn belongs to. Null before one exists, where the
   * route creating it is the intended behavior. */
  chatId?: string | null;
  /** Whether anything has finished processing. Nothing to search without it. */
  hasReadyDocuments: boolean;
  /** Set while this conversation is full, which closes the composer. */
  messageCap?: CapCopy | null;
  /** Whether this transcript is stored, and so has anything to delete. */
  canDelete?: boolean;
  /** Searchable filenames. Only a refusal reads these, to say what it *can*
   * answer from. */
  documents?: readonly string[];
  /** Changes what a refusal offers: upload, or sign in, or neither. */
  canUpload?: boolean;
  /** Changes what a capacity refusal offers, not whether one happens — signing in
   * really does buy headroom, since the global cap reserves it. */
  signedIn?: boolean;
  /** Server-rendered; empty for guests, whose chats are never persisted. */
  initialMessages?: ChatUIMessage[];
  /** Fires once a turn is written down, so server-rendered views refetch. Omitted
   * for guests, where a refetch returns the same thing. */
  onTurnComplete?: (() => void) | undefined;
  /** Changes the empty state: the demo offers starter questions, and cannot say
   * "your documents" because they are not yours. */
  isDemo?: boolean;
  /** Lifted, because the document list opens the same panel and two of them can
   * be on screen at once otherwise. */
  onOpenSource: (source: ChatSource) => void;
  /** Which chip reads as pressed. Owned above for the same reason. */
  openChunkId: string | null;
  /** Local mode supplies one that never leaves the browser. Unset means the
   * workspace route, which is what every server-backed surface uses. */
  transport?: ChatTransport<ChatUIMessage>;
  /** Overrides where the refusal points for uploads. Null means the upload area
   * is on this page already, which is how local mode uses it. */
  uploadHref?: string | null;
}) {
  // Memoized, or every render allocates a transport and `useChat` is handed a
  // new object each time.
  const routeTransport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `/api/w/${workspaceId}/chat`,
        // Without this the route never learns which conversation is open and
        // falls back to the most recent, so a turn sent from an older one lands
        // in a different transcript. `body` replaces rather than merges, so
        // `messages` has to be named here too.
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, chatId },
        }),
      }),
    [workspaceId, chatId],
  );

  const {
    messages,
    setMessages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    clearError,
  } = useChat<ChatUIMessage>({
    messages: initialMessages,
    transport: transport ?? routeTransport,
    // Server-rendered counts and titles sat stale until a reload. Unconditional,
    // and safe the moment the stream closes: the route commits inside
    // `streamText`'s own `onFinish`, which an integration test pins.
    onFinish: () => onTurnComplete?.(),
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // `Answer` carries 428 KB, kept out of the initial bundle. Warming on *submit*
  // was too late: the chunk arrived 449ms into a 962ms first answer, against
  // 46ms for later ones — it was not overlapping the wait, it was the wait.
  useEffect(() => {
    // Safari has only shipped `requestIdleCallback` recently; a timeout is the
    // fallback rather than skipping the warm-up on those browsers entirely.
    if (typeof requestIdleCallback !== "function") {
      const timer = setTimeout(warmAnswer, 1_000);
      return () => clearTimeout(timer);
    }

    const handle = requestIdleCallback(warmAnswer, { timeout: 2_000 });
    return () => cancelIdleCallback(handle);
  }, []);

  function ask(question: string) {
    void sendMessage({ text: question });
  }

  /*
    Hidden first, then confirmed. The action answers `{ deleted }` rather than
    throwing on a miss, so a turn that is still stored goes back on screen
    instead of silently disappearing until a reload contradicts it.
  */
  async function deleteTurn(messageId: string) {
    if (!chatId) return;

    const before = messages;
    const from = before.findIndex((message) => message.id === messageId);
    if (from < 0) return;

    // Up to the next question, matching what the server deletes.
    const next = before.findIndex(
      (message, index) => index > from && message.role === "user",
    );
    const until = next < 0 ? before.length : next;

    setDeletingId(messageId);
    setMessages([...before.slice(0, from), ...before.slice(until)]);

    try {
      const { deleted } = await deleteConversationTurn(
        workspaceId,
        chatId,
        messageId,
      );

      if (!deleted) {
        setMessages(before);
        setDeleteError(
          "That exchange was not deleted. It may already be gone.",
        );
        return;
      }

      setDeleteError(null);
      onTurnComplete?.();
    } catch {
      setMessages(before);
      setDeleteError("Could not reach the server. Nothing was deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  // Every question here would retrieve nothing and get the same refusal, which
  // reads as broken rather than empty.
  if (!hasReadyDocuments && messages.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm sm:p-6">
        <p>Nothing to search yet.</p>
        <p className="mt-1">
          Once a document has finished processing, you can ask questions about
          it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status, not the tokens: a live region around streaming text makes a
          screen reader re-read the answer on every token. */}
      <p aria-live="polite" className="sr-only">
        {status === "submitted"
          ? "Searching the documents."
          : status === "streaming"
            ? "Writing an answer."
            : status === "error"
              ? "The answer failed."
              : ""}
      </p>

      {/* Past the transcript rather than through it: every answer carries
          citation chips, and now every question carries a control. Same pattern
          as the header's own skip link. */}
      <a
        href="#chat-question"
        className="focus:bg-background focus:ring-ring sr-only focus:not-sr-only focus:rounded-md focus:px-3 focus:py-2 focus:ring-2"
      >
        Skip to the question box
      </a>

      <div className="border-border min-h-64 rounded-lg border p-(--card-spacing)">
        <MessageList
          messages={messages}
          onSelectSource={onOpenSource}
          selectedChunkId={openChunkId}
          // `=== undefined`, not `??`: null is an explicit "no link, the
          // upload area is on this page", and `??` would swallow it.
          uploadHref={
            uploadHref === undefined ? `/w/${workspaceId}` : uploadHref
          }
          documents={documents}
          canUpload={canUpload}
          signedIn={signedIn}
          isDemo={isDemo}
          onAsk={ask}
          // Only where the transcript is stored: a guest's vanishes on reload,
          // so a control offering to delete it would describe nothing.
          onDeleteTurn={
            canDelete && chatId ? (id) => void deleteTurn(id) : undefined
          }
          deletingId={deletingId}
          pending={status === "submitted"}
          streaming={status === "streaming"}
        />
      </div>

      {deleteError ? (
        <Notice
          icon={
            <Trash2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          }
          tone="destructive"
          title="That exchange is still here"
          detail={deleteError}
        />
      ) : null}

      {error ? (
        <ChatError
          refusal={parseRefusal(error)}
          capRefusal={parseCapRefusal(error)}
          signedIn={signedIn}
          onRetry={() => {
            clearError();
            void regenerate();
          }}
        />
      ) : null}

      {messageCap ? (
        // Above the composer it disables, so the reason is reached first.
        <Notice
          icon={
            <MessageSquareOff
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
          }
          tone="muted"
          title={messageCap.title}
          detail={messageCap.detail}
        />
      ) : null}

      <Composer
        isDemo={isDemo}
        onSubmit={ask}
        // `void`: a floating promise on an event handler silently swallows
        // rejections.
        onStop={() => void stop()}
        isStreaming={isStreaming}
        disabled={messageCap !== null}
      />
    </div>
  );
}
