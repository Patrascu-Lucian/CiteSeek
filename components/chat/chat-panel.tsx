"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";

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
}: {
  workspaceId: string;
  /** Whether anything has finished processing. Nothing to search without it. */
  hasReadyDocuments: boolean;
}) {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<ChatSource | null>(null);

  const { messages, sendMessage, regenerate, stop, status, error, clearError } =
    useChat<ChatUIMessage>({
      transport: new DefaultChatTransport({
        api: `/api/w/${workspaceId}/chat`,
      }),
    });

  const isStreaming = status === "streaming" || status === "submitted";

  function ask() {
    const question = input.trim();
    if (question.length === 0) return;

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
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-lg border p-3 text-sm"
        >
          <AlertCircle
            aria-hidden="true"
            className="text-destructive mt-0.5 size-4 shrink-0"
          />
          <div className="flex-1">
            <p className="font-medium">That answer didn&apos;t come through.</p>
            <p className="text-muted-foreground mt-1">
              The connection may have dropped. Your question is still here.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearError();
              void regenerate();
            }}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Retry
          </Button>
        </div>
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
