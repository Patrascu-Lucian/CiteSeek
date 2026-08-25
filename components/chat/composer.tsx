import {
  type KeyboardEvent,
  type SyntheticEvent,
  useRef,
  useState,
} from "react";
import { ArrowUp, Square } from "lucide-react";

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
  isDemo = false,
}: {
  /** Receives the trimmed question. The field clears itself afterward. */
  onSubmit: (question: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  /** The demo is shared and read-only, so the documents are not the reader's. */
  isDemo?: boolean;
}) {
  const subject = isDemo ? "the handbook" : "your documents";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  /* `auto` first, or `scrollHeight` can only ever grow. The border is added back
     because `border-box` counts it in `height` and `scrollHeight` does not. */
  function fit(element: HTMLTextAreaElement) {
    const style = getComputedStyle(element);
    const border =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + border}px`;
  }

  function submit(event?: SyntheticEvent) {
    event?.preventDefault();
    const question = value.trim();
    if (question.length === 0 || isStreaming) return;

    setValue("");
    onSubmit(question);
    // Focus stays in the composer so a follow-up question can be typed without
    // reaching for the mouse.
    textareaRef.current?.focus();
    // Back to one row: the value is cleared here rather than by typing, so
    // nothing else would measure it.
    if (textareaRef.current) fit(textareaRef.current);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="sr-only" htmlFor="chat-question">
        Ask a question about {subject}
      </label>

      {/* The ring moves to the box, since the field no longer has its own edge. */}
      <div className="border-input bg-background focus-within:ring-ring flex items-end gap-2 rounded-md border p-1.5 focus-within:ring-2">
        <textarea
          id="chat-question"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            setValue(event.target.value);
            fit(event.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Ask a question about ${subject}…`}
          // Grows with the question and stops at `max-h-40`, after which it
          // scrolls — a composer that can take the whole panel leaves nowhere to
          // read the answer it is about to get.
          className="max-h-40 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1.5 py-1 text-sm outline-none disabled:opacity-50"
        />

        {/*
          One button, not two swapped by a branch: it changes identity under a
          reader's focus the moment a stream opens, and a remount would drop that
          focus to the body. `items-end` puts it beside a one-line question and
          under a grown one.
        */}
        <Button
          type={isStreaming ? "button" : "submit"}
          variant={isStreaming ? "outline" : "default"}
          size="icon"
          className="rounded-full"
          aria-label={isStreaming ? "Stop the answer" : "Send the question"}
          onClick={isStreaming ? onStop : undefined}
          disabled={isStreaming ? false : disabled || value.trim().length === 0}
        >
          {isStreaming ? (
            <Square aria-hidden="true" className="size-3.5" />
          ) : (
            <ArrowUp aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
