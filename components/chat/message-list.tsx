import dynamic from "next/dynamic";
import { MessageSquare } from "lucide-react";

import type { ChatSource, ChatUIMessage, RefusalReason } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

import { Refusal } from "./refusal";

/**
 * The Markdown renderer is loaded on demand, not with the page.
 *
 * `Answer` pulls in Streamdown, which carries a Markdown parser, a diagram
 * renderer, a syntax highlighter and a maths typesetter — **428 KB raw in one
 * chunk**, measured, and it was arriving in the initial HTML of every workspace
 * visit. Nobody needs it until an assistant message exists, and a guest opening
 * the demo has none: the conversation starts empty.
 *
 * `ssr` stays on, so a signed-in reader's restored transcript still
 * server-renders. What changes is when the *client* chunk is fetched.
 *
 * `ChatPanel` warms it at idle — see `warmAnswer` below for why on submit was
 * measurably too late.
 */
const Answer = dynamic(() => import("./answer").then((m) => m.Answer), {
  /*
    Without this, `dynamic` renders `null` while the chunk is in flight — so the
    first answer's bubble appeared, collapsed to nothing, and then filled in.
    Measured on a production build, the chunk landed 478ms into a first answer;
    on the dev server, where Next compiles it on demand, **1006ms into a 1433ms
    answer**. Every later answer on the same page reused it and was instant.

    That one-time gap is what made the first reply of a session look like the
    page was reloading itself. Reserving the space keeps the layout still while
    it loads, which is the same reason every route here has a `loading.tsx`.
  */
  loading: () => (
    <div aria-hidden="true" className="space-y-2 py-1">
      <div className="bg-foreground/10 h-3 w-48 animate-pulse rounded" />
      <div className="bg-foreground/10 h-3 w-32 animate-pulse rounded" />
    </div>
  ),
});

/**
 * Fetches the chunk above ahead of time. Called by `ChatPanel` at idle.
 *
 * It lives beside the `dynamic()` call rather than in `ChatPanel` so that one
 * module owns when this chunk is loaded. Measured: warming at idle takes the two
 * large Streamdown chunks off the first answer's critical path — three chunk
 * fetches during the first send became one. The one that remains is this
 * module's own wrapper, a couple of kilobytes, which the loader still resolves
 * when the component first renders; the placeholder above covers it.
 */
export function warmAnswer() {
  void import("./answer");
}

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
 * The refusal reason attached to a message, if it is a refusal.
 *
 * Present only when retrieval found nothing, which is also exactly when there
 * are no sources — the two parts are mutually exclusive by construction, and a
 * message carrying both would mean the route had grounded and refused the same
 * turn.
 */
export function messageRefusal(message: ChatUIMessage): RefusalReason | null {
  const part = message.parts.find(
    (candidate) => candidate.type === "data-refusal",
  );

  return part && "data" in part ? part.data.reason : null;
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
  workspaceId,
  documents,
  canUpload,
  signedIn,
}: {
  messages: readonly ChatUIMessage[];
  onSelectSource: (source: ChatSource) => void;
  selectedChunkId: string | null;
  workspaceId: string;
  /** Searchable filenames, for a refusal to say what it can answer from. */
  documents: readonly string[];
  canUpload: boolean;
  signedIn: boolean;
}) {
  if (messages.length === 0) return <EmptyState />;

  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        const isUser = message.role === "user";
        const refusal = messageRefusal(message);

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
                <>
                  <Answer
                    text={messageText(message)}
                    sources={messageSources(message)}
                    onSelectSource={onSelectSource}
                    selectedChunkId={selectedChunkId}
                  />
                  {/* Below the text, not instead of it: the sentence saying
                      nothing was found is still the answer to the question. */}
                  {refusal ? (
                    <Refusal
                      reason={refusal}
                      documents={documents}
                      canUpload={canUpload}
                      signedIn={signedIn}
                      workspaceId={workspaceId}
                    />
                  ) : null}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
