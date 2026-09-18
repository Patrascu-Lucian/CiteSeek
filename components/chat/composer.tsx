import {
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* `auto` first, or `scrollHeight` can only ever grow. The border is added back
   because `border-box` counts it in `height` and `scrollHeight` does not. */
function fit(element: HTMLTextAreaElement) {
  const style = getComputedStyle(element);
  const border =
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + border}px`;
}

/* Always the width it has beside the button: read at the stacked width, a
   question that only wraps beside it unstacks, re-wraps in the narrower row
   and stacks again. Past 1.5 rows rather than 2, because sub-pixel line
   heights read an exact two rows as 1.98. */
function rowsBesideTheButton(
  element: HTMLTextAreaElement,
  send: HTMLButtonElement | null,
  stacked: boolean,
): number {
  const style = getComputedStyle(element);
  const row = element.parentElement;
  const gap = row ? parseFloat(getComputedStyle(row).columnGap) : Number.NaN;
  const beside = element.clientWidth - (send?.offsetWidth ?? Number.NaN) - gap;

  const flex = element.style.flex;
  const width = element.style.width;
  const height = element.style.height;
  if (stacked && Number.isFinite(beside)) {
    // A flex item takes its size from the container, which would ignore the
    // width this is measuring at.
    element.style.flex = "none";
    element.style.width = `${beside}px`;
  }
  element.style.height = "auto";
  const content = element.scrollHeight;
  element.style.height = height;
  element.style.width = width;
  element.style.flex = flex;

  return (
    (content - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) /
    parseFloat(style.lineHeight)
  );
}

/** The draft lives here, not in `ChatPanel`: lifted, every keystroke re-parsed
 * the transcript through Streamdown — 20 renders for 19 characters — and nothing
 * above reads it. */
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
  const sendRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState("");
  const [stacked, setStacked] = useState(false);

  // The width changes with the row, so the height measured in the other layout
  // is wrong by a row: re-fit once the browser has laid the new one out.
  useLayoutEffect(() => {
    if (textareaRef.current) fit(textareaRef.current);
  }, [stacked]);

  /* A keystroke is not the only thing that changes the width: rotating a phone
     or resizing a window strands the row where the last one left it. This is the
     only place a width moves without an input event. Width alone, because `fit`
     changes the height and observing that would answer itself. */
  useEffect(() => {
    const element = textareaRef.current;
    const row = element?.parentElement;
    if (!element || !row || typeof ResizeObserver === "undefined") return;

    let width = row.clientWidth;
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === width) return;
      width = row.clientWidth;

      fit(element);
      setStacked(rowsBesideTheButton(element, sendRef.current, stacked) > 1.5);
    });

    observer.observe(row);
    return () => {
      observer.disconnect();
    };
    // Not `[]`: the callback measures from whichever row it is in, so an
    // observer subscribed once would read the inline width forever.
  }, [stacked]);

  function submit(event?: SyntheticEvent) {
    event?.preventDefault();
    const question = value.trim();
    if (question.length === 0 || isStreaming) return;

    setValue("");
    setStacked(false);
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
      <div
        data-stacked={stacked || undefined}
        className={cn(
          "border-input bg-background focus-within:ring-ring flex gap-2 rounded-md border p-1.5 focus-within:ring-2",
          stacked ? "flex-col" : "items-end",
        )}
      >
        <textarea
          id="chat-question"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            setValue(event.target.value);
            fit(event.target);
            setStacked(
              rowsBesideTheButton(event.target, sendRef.current, stacked) > 1.5,
            );
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Ask a question about ${subject}…`}
          // Grows with the question and stops at `max-h-40`, after which it
          // scrolls — a composer that can take the whole panel leaves nowhere to
          // read the answer it is about to get.
          className={cn(
            "max-h-40 min-w-0 resize-none overflow-y-auto bg-transparent px-1.5 py-1 text-sm outline-none disabled:opacity-50",
            // `flex-1` grows along the main axis, and stacking turns that axis
            // vertical: it then overrides the height `fit` measured and collapses
            // the field to one row.
            stacked ? "w-full" : "flex-1",
          )}
        />

        {/*
          One button, not two swapped by a branch: it changes identity under a
          reader's focus the moment a stream opens, and a remount would drop that
          focus to the body. Stacking is a class on this same element for the
          same reason: a wrapper rendered only when stacked would remount it on
          every transition instead of once per stream.
        */}
        <Button
          ref={sendRef}
          type={isStreaming ? "button" : "submit"}
          variant={isStreaming ? "outline" : "default"}
          size="icon"
          // Not the Button base's `rounded-lg`, which is rounder than the
          // `rounded-md` box it sits inside.
          className={cn("rounded-md", stacked && "self-end")}
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
