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
}: {
  workspaceId: string;
  /** Whether anything has finished processing. Nothing to search without it. */
  hasReadyDocuments: boolean;
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
        The conversation list is server-rendered — its titles and message counts
        come from the database — and nothing was telling it a turn had happened.
        The count sat stale until the reader navigated or reloaded, and the title
        a first question generates did not appear at all.

        Fired unconditionally, including on abort and error: the route persists
        whatever the reader was shown, a stopped answer included, so "the stream
        ended" and "there may be something new to show" are the same event. A
        refetch that finds nothing new costs one RSC request and renders the same
        markup.

        Safe to run the instant the stream closes, which is not obvious and is
        asserted by an integration test: the route persists inside `streamText`'s
        own `onFinish`, and that transaction has committed before the response
        body ends. Were it the other way round, this would refetch a count one
        turn behind and look like the same bug arriving a moment later.
      */
      onFinish: () => onTurnComplete?.(),
    });

  const isStreaming = status === "streaming" || status === "submitted";

  /*
    Warm the Markdown chunk once the page is idle.

    `MessageList` loads `Answer` on demand — it carries Streamdown and 428 KB of
    parser, diagram and highlighter code that no empty conversation needs, and
    keeping it out of the initial bundle is the point of the split.

    This used to warm on submit, on the reasoning that retrieval and the first
    token take about a second, which is ample time to fetch it. Measured against
    a production build, that was wrong: the chunk arrived 449ms into a first
    answer that took **962ms**, while every later answer on the same page took
    **46ms**. It was not overlapping the wait, it *was* the wait — a visible
    one-time stall on the first question of every visit, and the reason the first
    answer looked like the page was reloading.

    Idle time is the right moment instead. `requestIdleCallback` runs after the
    page has settled, so this competes with nothing the reader is waiting on, and
    it finishes long before anyone has typed a question. The bundle win survives
    — the chunk is still absent from the initial HTML and payload — and the
    stall does not.

    Fire-and-forget by design: a failed prefetch is not an error, because the
    real import still runs when the component renders.
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
