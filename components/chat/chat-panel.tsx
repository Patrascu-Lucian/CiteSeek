import { useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatTransport } from "ai";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";
import { parseCapRefusal } from "@/lib/limits/caps";
import { parseRefusal } from "@/lib/usage/limits";

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
  transport,
  uploadHref,
}: {
  workspaceId: string;
  /** Whether anything has finished processing. Nothing to search without it. */
  hasReadyDocuments: boolean;
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
      }),
    [workspaceId],
  );

  const { messages, sendMessage, regenerate, stop, status, error, clearError } =
    useChat<ChatUIMessage>({
      messages: initialMessages,
      transport: transport ?? routeTransport,
      /*
        The conversation list is server-rendered, so counts and titles sat stale
        until a reload. Unconditional — the route persists whatever was shown, a
        stopped answer included — and safe the instant the stream closes, since
        the route commits inside `streamText`'s `onFinish` before the body ends.
        An integration test pins that, or this refetches a count one turn behind.
      */
      onFinish: () => onTurnComplete?.(),
    });

  const isStreaming = status === "streaming" || status === "submitted";

  /*
    `Answer` carries Streamdown and 428 KB of parser and highlighter, kept out of
    the initial bundle. Warming on *submit* was measurably too late — the chunk
    arrived 449ms into a 962ms first answer, against 46ms for later ones. It was
    not overlapping the wait, it was the wait.

    Fire-and-forget: the real import still runs when the component renders.
  */
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
      {/*
        Status is announced rather than the tokens themselves. A live region
        wrapped around streaming text makes a screen reader read the answer again
        on every token — technically "announced", practically unusable. This says
        what is happening; the answer itself is read normally once it settles.
      */}
      <p aria-live="polite" className="sr-only">
        {status === "submitted"
          ? "Searching the documents."
          : status === "streaming"
            ? "Writing an answer."
            : status === "error"
              ? "The answer failed."
              : ""}
      </p>

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
          pending={status === "submitted"}
          streaming={status === "streaming"}
        />
      </div>

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

      <Composer
        isDemo={isDemo}
        onSubmit={ask}
        // `void`: a floating promise on an event handler silently swallows
        // rejections.
        onStop={() => void stop()}
        isStreaming={isStreaming}
        disabled={false}
      />
    </div>
  );
}
