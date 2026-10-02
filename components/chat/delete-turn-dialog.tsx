import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { shortenQuestion } from "./turn-label";

/** Same rule as a conversation and a document (ADR 042): name what goes, and say
 * the answer goes with the question. */
export function DeleteTurnDialog({
  question,
  hasAnswer,
  busy,
  onConfirm,
}: {
  question: string;
  hasAnswer: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const label = shortenQuestion(question);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost-destructive"
          size="icon-xs"
          aria-label={`Delete the exchange starting “${label}”`}
          disabled={busy}
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasAnswer
              ? "The answer to it goes as well — they are one exchange."
              : "This question will be permanently deleted."}{" "}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete exchange
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
