import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The question input.
 *
 * Enter sends, Shift+Enter inserts a newline — the convention every chat client
 * uses, and the reason this is a textarea rather than an input: a question about
 * a document is often longer than one line.
 *
 * **The draft lives here, not in `ChatPanel`.** It used to be lifted, which made
 * every keystroke re-render the panel and everything under it — including
 * `MessageList`, which re-renders each `Answer`, each of which re-parses its
 * Markdown through Streamdown. On a conversation with a few answers in it,
 * typing one character rebuilt the entire transcript, and it looked like the
 * page was reloading as you typed.
 *
 * Lifting state is the right default and it was wrong here for a specific
 * reason: **nothing above this component reads the draft.** The panel only needs
 * the text at the moment of submission, which `onSubmit` hands it. State belongs
 * at the lowest level that can serve every reader of it, and that level is this
 * form.
 */
export function Composer({
  onSubmit,
  onStop,
  isStreaming,
  disabled,
}: {
  /** Receives the trimmed question. The field clears itself afterward. */
  onSubmit: (question: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const question = value.trim();
    if (question.length === 0 || isStreaming) return;

    setValue("");
    onSubmit(question);
    // Focus stays in the composer so a follow-up question can be typed without
    // reaching for the mouse.
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label className="sr-only" htmlFor="chat-question">
        Ask a question about your documents
      </label>
      <textarea
        id="chat-question"
        ref={textareaRef}
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your documents…"
        className="border-input bg-background focus-visible:ring-ring flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      />

      {isStreaming ? (
        <Button type="button" variant="outline" onClick={onStop}>
          <Square aria-hidden="true" className="size-4" />
          Stop
        </Button>
      ) : (
        <Button type="submit" disabled={disabled || value.trim().length === 0}>
          <Send aria-hidden="true" className="size-4" />
          Send
        </Button>
      )}
    </form>
  );
}
