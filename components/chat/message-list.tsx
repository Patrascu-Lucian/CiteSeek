import dynamic from "next/dynamic";
import { MessageSquare, Pencil } from "lucide-react";

import type { ChatSource, ChatUIMessage, RefusalReason } from "@/lib/ai/types";
import { DEMO_EXAMPLE_QUESTIONS } from "@/lib/demo/example-questions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { DeleteTurnDialog } from "./delete-turn-dialog";
import { EditQuestionForm } from "./edit-question-form";
import { TurnActions } from "./turn-actions";
import { Refusal } from "./refusal";

/** `Answer` pulls in Streamdown — **428 KB raw**, measured, and it was in the
 * initial HTML of every visit. `ssr` stays on; only the client fetch is deferred. */
const Answer = dynamic(() => import("./answer").then((m) => m.Answer), {
  // Without this `dynamic` renders `null` mid-flight, so the first bubble
  // appeared, collapsed and refilled — 478ms built, 1006ms on the dev server.
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

/** Present only when the typed question retrieved nothing and a rewrite of it
 * did, so the reader can see a wrong guess rather than an off-topic answer. */
export function messageSearchedFor(message: ChatUIMessage): string | null {
  return message.metadata?.searchedFor ?? null;
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
  onDeleteTurn,
  onEditQuestion,
  onStartEdit,
  onCancelEdit,
  editingId = null,
  busyId = null,
  deletingId = null,
  pending = false,
  streaming = false,
}: {
  messages: readonly ChatUIMessage[];
  onSelectSource: (source: ChatSource) => void;
  selectedChunkId: string | null;
  /** Omitted where the transcript is not stored, so there is nothing to delete. */
  onDeleteTurn?: (messageId: string) => void;
  /** Receives the reworded question. Everything below it goes with the old one. */
  onEditQuestion?: (messageId: string, question: string) => void;
  onStartEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
  /** The question currently open for editing, if any. */
  editingId?: string | null;
  /** The exchange whose edit is in flight. */
  busyId?: string | null;
  /** The exchange whose delete is in flight. */
  deletingId?: string | null;
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
  /** Only the last message can be mid-stream, and only it needs holding back
   * from the "nothing here is cited" note until its markers have arrived. */
  streaming?: boolean;
}) {
  if (messages.length === 0 && !pending)
    return <EmptyState isDemo={isDemo} onAsk={onAsk} />;

  return (
    <ol className="space-y-4">
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const refusal = messageRefusal(message);
        const searchedFor = messageSearchedFor(message);
        const settled = !streaming || index < messages.length - 1;

        // On the question, which is what names the exchange — the rule
        // `deleteTurn` enforces in SQL. Not while its answer is still arriving.
        // `pending` as well as `streaming`: between submit and the first token the
        // question is the newest message and nothing is streaming yet, so the
        // controls offered to act on a turn the server had not written down.
        const deletable =
          isUser &&
          onDeleteTurn &&
          !((streaming || pending) && index >= messages.length - 2);

        if (editingId === message.id && onEditQuestion) {
          return (
            <li key={message.id} className="flex justify-end">
              <div className="w-full max-w-[85%]">
                <EditQuestionForm
                  initialQuestion={messageText(message)}
                  busy={busyId === message.id}
                  onSubmit={(question) => onEditQuestion(message.id, question)}
                  onCancel={onCancelEdit ?? (() => undefined)}
                />
              </div>
            </li>
          );
        }

        const bubble = (
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
            <span className="sr-only">{isUser ? "You asked:" : "Answer:"}</span>

            {isUser ? (
              <p className="whitespace-pre-wrap">{messageText(message)}</p>
            ) : (
              <>
                {/* Above the answer, because it changes what the answer is an
                    answer to. */}
                {searchedFor ? (
                  <p
                    className="text-muted-foreground mb-2 text-xs"
                    data-searched-for=""
                  >
                    {/* Not "Searched for" twice: the visible label is hidden
                        from assistive tech, so this one carries the fact. */}
                    {/* Not "rephrased": local mode joins the previous turn to
                        this one rather than rewriting it (ADR 048). */}
                    <span className="sr-only">
                      Your question found nothing, so this searched for:{" "}
                    </span>
                    <span aria-hidden="true">Searched for: </span>
                    {searchedFor}
                  </p>
                ) : null}

                <Answer
                  text={messageText(message)}
                  sources={messageSources(message)}
                  onSelectSource={onSelectSource}
                  selectedChunkId={selectedChunkId}
                  settled={settled}
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
        );

        return (
          <li
            key={message.id}
            className={cn("flex", isUser ? "justify-end" : "justify-start")}
          >
            {deletable ? (
              <TurnActions bubble={bubble} className="justify-end">
                {onEditQuestion ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit the question “${messageText(message)}”`}
                    disabled={busyId === message.id}
                    onClick={() => onStartEdit?.(message.id)}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                  </Button>
                ) : null}
                <DeleteTurnDialog
                  question={messageText(message)}
                  hasAnswer={messages[index + 1]?.role === "assistant"}
                  busy={deletingId === message.id}
                  onConfirm={() => onDeleteTurn(message.id)}
                />
              </TurnActions>
            ) : (
              bubble
            )}
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
