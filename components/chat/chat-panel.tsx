// The server → client boundary for chat. `page.tsx` is a Server Component and
// imports this directly; everything this file imports is pulled into the client
// bundle with it and needs no directive of its own.
//
// Kept here and nowhere below on purpose: the directive *is* the boundary, so
// repeating it on every component hides where the split actually happens — and
// makes Next's TypeScript plugin treat each one as a server-facing entry, which
// it then (correctly, for an entry) flags for taking function props.
"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";
import { parseRefusal } from "@/lib/usage/limits";

import { ChatError } from "./chat-error";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { SourcePanel } from "./source-panel";

/**
 * Owns the conversation and everything that mutates it.
 *
 * Same shape as `DocumentsPanel`: one owner of state, presentational children,
 * no prop copied into state. `useChat` holds the messages; this component adds
 * the input value and which source the reader has opened.
 */
export function ChatPanel({
  workspaceId,
  hasReadyDocuments,
  signedIn = false,
  initialMessages = [],
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
}) {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<ChatSource | null>(null);

  const { messages, sendMessage, regenerate, stop, status, error, clearError } =
    useChat<ChatUIMessage>({
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/w/${workspaceId}/chat`,
      }),
    });

  const isStreaming = status === "streaming" || status === "submitted";

  function ask() {
    const question = input.trim();
    if (question.length === 0) return;

    // Warm the markdown chunk while the question is in flight. `MessageList`
    // loads `Answer` on demand — it carries Streamdown and 428 KB of parser,
    // diagram and highlighter code that no empty conversation needs. Retrieval
    // and the first token take on the order of a second, which is ample time to
    // fetch it, so the split costs nothing the reader can see.
    //
    // Fire-and-forget by design: a failed prefetch is not an error, because the
    // real import still runs when the component renders.
    void import("./answer");

    setInput("");
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
        value={input}
        onChange={setInput}
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
