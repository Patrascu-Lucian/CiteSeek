import dynamic from "next/dynamic";
import { MessageSquare } from "lucide-react";

import type { ChatSource, ChatUIMessage, RefusalReason } from "@/lib/ai/types";
import { DEMO_EXAMPLE_QUESTIONS } from "@/lib/demo/example-questions";
import { cn } from "@/lib/utils";

import { Refusal } from "./refusal";

/**
 * `Answer` pulls in Streamdown — **428 KB raw**, measured, and it was in the
 * initial HTML of every workspace visit despite an empty conversation needing
 * none of it. `ssr` stays on; only the client fetch is deferred.
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
 * Called by `ChatPanel` at idle. Beside the `dynamic()` call so one module owns
 * when this loads. Measured: three chunk fetches on the first send became one.
 */
export function warmAnswer() {
  void import("./answer");
}

/** Presentational; `ChatPanel` owns every piece of state rendered here. */

/** The text of a message, concatenated across its parts. */
export function messageText(message: ChatUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/** Mutually exclusive with sources by construction: a message carrying both would
 * mean the route grounded and refused the same turn. */
export function messageRefusal(message: ChatUIMessage): RefusalReason | null {
  const part = message.parts.find(
    (candidate) => candidate.type === "data-refusal",
  );

  return part && "data" in part ? part.data.reason : null;
}

/** Written by the route before any text, so a chip can render the moment its
 * marker is typed. */
export function messageSources(message: ChatUIMessage): ChatSource[] {
  const part = message.parts.find(
    (candidate) => candidate.type === "data-sources",
  );

  return part && "data" in part ? part.data : [];
}

function EmptyState({
  isDemo,
  onAsk,
}: {
  isDemo: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center">
      <MessageSquare aria-hidden="true" className="size-6" />
      <div>
        <p className="text-foreground text-sm font-medium">
          {/* The demo is shared and read-only, so "your documents" is false there
              — and it is the first sentence a stranger reads. */}
          {isDemo
            ? "Ask a question about the handbook"
            : "Ask a question about your documents"}
        </p>
        <p className="mt-1 text-sm">
          Answers cite the passages they come from, so you can check them.
        </p>
      </div>

      {/*
        Only the demo gets these. A reader who has uploaded their own documents
        knows what is in them;
      */}
      {isDemo ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs">Or start with one of these:</p>
          <ul className="flex flex-col items-center gap-2">
            {DEMO_EXAMPLE_QUESTIONS.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => onAsk(question)}
                  className="border-border/60 hover:bg-muted focus-visible:ring-ring text-foreground rounded-full border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function MessageList({
  messages,
  onSelectSource,
  selectedChunkId,
  uploadHref,
  documents,
  canUpload,
  signedIn,
  isDemo,
  onAsk,
  pending = false,
}: {
  messages: readonly ChatUIMessage[];
  onSelectSource: (source: ChatSource) => void;
  selectedChunkId: string | null;
  /** Passed through to the refusal, which is the only thing that needs it. */
  uploadHref: string | null;
  /** Searchable filenames, for a refusal to say what it can answer from. */
  documents: readonly string[];
  canUpload: boolean;
  signedIn: boolean;
  /** The seeded workspace, which is shared and read-only. */
  isDemo: boolean;
  onAsk: (question: string) => void;
  /** Asked, nothing back yet — measured at ~1.03s to the first token. */
  pending?: boolean;
}) {
  if (messages.length === 0 && !pending)
    return <EmptyState isDemo={isDemo} onAsk={onAsk} />;

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
              // Marks the surface a chip is drawn on, so a test can compare the
              // two backgrounds — a chip was once painted in exactly this color
              // and vanished, which no automated rule catches.
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
                      uploadHref={uploadHref}
                    />
                  ) : null}
                </>
              )}
            </div>
          </li>
        );
      })}

      {/* The skeleton the streamed answer arrives into, so the bubble fills
          rather than replacing itself. */}
      {pending ? (
        <li className="flex justify-start">
          <div
            data-message-bubble="assistant"
            data-pending=""
            className="bg-muted text-foreground max-w-[85%] rounded-lg px-4 py-3 text-sm"
          >
            <span className="sr-only">Answer:</span>
            <div aria-hidden="true" className="space-y-2 py-1">
              <div className="bg-foreground/10 h-3 w-48 animate-pulse rounded" />
              <div className="bg-foreground/10 h-3 w-32 animate-pulse rounded" />
            </div>
          </div>
        </li>
      ) : null}
    </ol>
  );
}
