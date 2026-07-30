import dynamic from "next/dynamic";
import { MessageSquare } from "lucide-react";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/**
 * The markdown renderer is loaded on demand, not with the page.
 *
 * `Answer` pulls in Streamdown, which carries a markdown parser, a diagram
 * renderer, a syntax highlighter and a maths typesetter — **428 KB raw in one
 * chunk**, measured, and it was arriving in the initial HTML of every workspace
 * visit. Nobody needs it until an assistant message exists, and a guest opening
 * the demo has none: the conversation starts empty.
 *
 * `ssr` stays on, so a signed-in reader's restored transcript still
 * server-renders. What changes is when the *client* chunk is fetched.
 *
 * `ChatPanel` warms it on submit, so it is in flight during the second or so
 * that retrieval and the first token take, rather than being requested at the
 * moment there is finally something to draw.
 */
const Answer = dynamic(() => import("./answer").then((m) => m.Answer));

/**
 * The transcript. Presentational — every piece of state it renders is owned by
 * `ChatPanel`, the same split as `DocumentList` and `DocumentsPanel`.
 */

/** The text of a message, concatenated across its parts. */
export function messageText(message: ChatUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * The sources attached to a message.
 *
 * Written by the route before any text, so this is populated from the first
 * chunk of a response rather than at the end — which is what lets a chip render
 * the moment its marker is typed.
 */
export function messageSources(message: ChatUIMessage): ChatSource[] {
  const part = message.parts.find(
    (candidate) => candidate.type === "data-sources",
  );

  return part && "data" in part ? part.data : [];
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center">
      <MessageSquare aria-hidden="true" className="size-6" />
      <div>
        <p className="text-foreground text-sm font-medium">
          Ask a question about your documents
        </p>
        <p className="mt-1 text-sm">
          Answers cite the passages they come from, so you can check them.
        </p>
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  onSelectSource,
  selectedChunkId,
}: {
  messages: readonly ChatUIMessage[];
  onSelectSource: (source: ChatSource) => void;
  selectedChunkId: string | null;
}) {
  if (messages.length === 0) return <EmptyState />;

  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        const isUser = message.role === "user";

        return (
          <li
            key={message.id}
            className={cn("flex", isUser ? "justify-end" : "justify-start")}
          >
            <div
              // Marks the surface a citation chip is drawn *on*, so a test can
              // compare the two backgrounds. The chip was once painted in
              // exactly this color and disappeared; no automated rule catches
              // that, so the regression test has to find this element reliably
              // rather than guess at an ancestor.
              data-message-bubble={isUser ? "user" : "assistant"}
              className={cn(
                "max-w-[85%] rounded-lg px-4 py-3 text-sm",
                isUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {/* The role is announced rather than inferred from alignment,
                  which carries no meaning to a screen reader. */}
              <span className="sr-only">
                {isUser ? "You asked:" : "Answer:"}
              </span>

              {isUser ? (
                <p className="whitespace-pre-wrap">{messageText(message)}</p>
              ) : (
                <Answer
                  text={messageText(message)}
                  sources={messageSources(message)}
                  onSelectSource={onSelectSource}
                  selectedChunkId={selectedChunkId}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
