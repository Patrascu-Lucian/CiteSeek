import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { answerAsText } from "@/lib/ai/answer-text";
import { citedMarkers } from "@/lib/ai/citations";
import type { ChatSource } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";

/** Long enough to read, short enough that a second copy is not blocked by it. */
const CONFIRM_MS = 2000;

/**
 * A citation is worth something outside the app too, which is where an answer
 * usually ends up — so this copies the prose with a numbered list of what each
 * marker was, rather than prose whose `[1]` points at nothing.
 */
export function CopyAnswer({
  text,
  sources,
}: {
  text: string;
  sources: readonly ChatSource[];
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        answerAsText(text, sources, citedMarkers(text, sources)),
      );
    } catch {
      // A denied permission or an insecure origin. Saying nothing is better than
      // a confirmation the clipboard did not earn.
      return;
    }

    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), CONFIRM_MS);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      // The label changes with the state, so the confirmation reaches a screen
      // reader without a live region announcing every other row's copy too.
      aria-label={copied ? "Answer copied" : "Copy the answer"}
      onClick={() => void copy()}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
    </Button>
  );
}
