// The server → client boundary for chat. `page.tsx` is a Server Component and
// imports this directly; everything this file imports is pulled into the client
// bundle with it and needs no directive of its own.
//
// Kept here and nowhere below on purpose: the directive *is* the boundary, so
// repeating it on every component hides where the split actually happens — and
// makes Next's TypeScript plugin treat each one as a server-facing entry, which
// it then (correctly, for an entry) flags for taking function props.
"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";
import { parseRefusal } from "@/lib/usage/limits";

import { ChatError } from "./chat-error";
import { Composer } from "./composer";
import { MessageList, warmAnswer } from "./message-list";
import { SourcePanel } from "./source-panel";

/**
 * Owns the conversation and everything that mutates it.
 *
 * Same shape as `DocumentsPanel`: one owner of state, presentational children,
 * no prop copied into state. `useChat` holds the messages; this component adds
 * which source the reader has opened.
 *
 * The draft question is deliberately *not* here — see `Composer`. Holding it at
 * this level re-rendered the whole transcript on every keystroke.
 */
export function ChatPanel({
  workspaceId,
  hasReadyDocuments,
  signedIn = false,
  initialMessages = [],
  onTurnComplete,
  documents = [],
  canUpload = false,
}: {
  workspaceId: string;
  /** Whether anything has finished processing. Nothing to search without it. */
  hasReadyDocuments: boolean;
  /**
   * Filenames of what is searchable now. Only a refusal reads these — to say
   * what it *can* answer from, which is the thing that makes it useful rather
   * than merely correct.
   */
  documents?: readonly string[];
  /** Changes what a refusal offers: upload, or sign in, or neither. */
  canUpload?: boolean;
  /**
   * Changes what a capacity refusal offers, not whether one happens. A guest is
   * told signing in gives them their own headroom, which is true because the
   * global cap reserves room below the guest ceiling.
   */
  signedIn?: boolean;
  /**
   * A signed-in user's stored conversation, server-rendered. Empty for guests,
   * whose chats are never persisted.
   */
  initialMessages?: ChatUIMessage[];
  /**
   * Called once a turn has been written down, so a server-rendered view of the
   * conversation can be refetched. Omitted for guests, whose turns are never
   * persisted and for whom a refetch would return the same thing.
   */
  onTurnComplete?: (() => void) | undefined;
}) {
  const [selected, setSelected] = useState<ChatSource | null>(null);

  const { messages, sendMessage, regenerate, stop, status, error, clearError } =
    useChat<ChatUIMessage>({
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/w/${workspaceId}/chat`,
      }),
      /*
        The conversation list is server-rendered, so its counts and titles sat
        stale until a reload. Fired unconditionally — the route persists whatever
        the reader was shown, a stopped answer included.

        Safe the instant the stream closes, which is not obvious: the route
        persists inside `streamText`'s own `onFinish` and that transaction has
        committed before the body ends. An integration test asserts it, because
        otherwise this would refetch a count one turn behind.
      */
      onFinish: () => onTurnComplete?.(),
    });

  const isStreaming = status === "streaming" || status === "submitted";

  /*
    Warm the Markdown chunk at idle.

    `Answer` carries Streamdown and 428 KB of parser and highlighter code, kept
    out of the initial bundle deliberately. Warming on *submit* was measurably
    too late: the chunk arrived 449ms into a first answer that took 962ms, while
    later answers took 46ms. It was not overlapping the wait, it was the wait.

    Fire-and-forget: a failed prefetch is not an error, the real import still
    runs when the component renders.
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

  // Every question against an empty workspace retrieves nothing and gets the
  // same refusal, which reads like a broken feature rather than an empty one.
  // Say why up front instead.
  if (!hasReadyDocuments && messages.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
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
          ? "Searching your documents."
          : status === "streaming"
            ? "Writing an answer."
            : status === "error"
              ? "The answer failed."
              : ""}
      </p>

      <div className="border-border min-h-64 rounded-lg border p-4">
        <MessageList
          messages={messages}
          onSelectSource={setSelected}
          selectedChunkId={selected?.chunkId ?? null}
          workspaceId={workspaceId}
          documents={documents}
          canUpload={canUpload}
          signedIn={signedIn}
        />
      </div>

      <SourcePanel
        source={selected}
        workspaceId={workspaceId}
        onClose={() => setSelected(null)}
      />

      {error ? (
        <ChatError
          refusal={parseRefusal(error)}
          signedIn={signedIn}
          onRetry={() => {
            clearError();
            void regenerate();
          }}
        />
      ) : null}

      <Composer
        onSubmit={ask}
        // `void` rather than passing it straight through: the prop is typed to
        // return void, and a floating promise on an event handler is the shape
        // that silently swallows rejections.
        onStop={() => void stop()}
        isStreaming={isStreaming}
        disabled={false}
      />
    </div>
  );
}
