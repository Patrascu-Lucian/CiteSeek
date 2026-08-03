import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Enter sends, Shift+Enter newlines — hence a textarea, since a question about a
 * document is often longer than one line.
 *
 * **The draft lives here, not in `ChatPanel`.** Lifted, every keystroke
 * re-rendered the panel and re-parsed every `Answer` through Streamdown —
 * measured at 20 transcript renders for 19 characters. Lifting is the right
 * default and was wrong here for one reason: **nothing above reads the draft.**
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
