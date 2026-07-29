import { type FormEvent, type KeyboardEvent, useRef } from "react";
import { Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The question input.
 *
 * Enter sends, Shift+Enter inserts a newline — the convention every chat client
 * uses, and the reason this is a textarea rather than an input: a question about
 * a document is often longer than one line.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (value.trim().length === 0 || isStreaming) return;

    onSubmit();
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
        onChange={(event) => onChange(event.target.value)}
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
