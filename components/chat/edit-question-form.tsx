import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Replaces the question in place, so the reader edits where they are reading
 * rather than in the composer below the answer they are replacing. */
export function EditQuestionForm({
  initialQuestion,
  busy,
  onSubmit,
  onCancel,
}: {
  initialQuestion: string;
  busy: boolean;
  onSubmit: (question: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialQuestion);
  const question = value.trim();

  return (
    <form
      className="w-full space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (question.length > 0) onSubmit(question);
      }}
    >
      <textarea
        // The field replaces the control just activated, so focus must follow or
        // a keyboard user is left on a button that no longer exists.
        autoFocus
        aria-label="Edit your question"
        rows={2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (question.length > 0) onSubmit(question);
          }
        }}
        className="border-input bg-background text-foreground focus-visible:ring-ring w-full resize-none rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={busy || question.length === 0}
        >
          Ask again
        </Button>
      </div>
    </form>
  );
}
