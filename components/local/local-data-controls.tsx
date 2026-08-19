"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deleteEverythingLocal,
  summarizeLocalStore,
  type LocalStoreSummary,
} from "@/lib/local/store";

type State =
  | { status: "loading" }
  | { status: "ready"; summary: LocalStoreSummary }
  | { status: "failed" };

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function LocalDataControls({
  refreshToken = 0,
  onCleared,
}: {
  refreshToken?: number;
  /** Deleting here empties the corpus the chat above is answering from, and
   * nothing else tells it so. */
  onCleared?: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const summary = useRef<HTMLParagraphElement>(null);

  // Returns the next state rather than setting it, so the effect below applies
  // it from a callback: a `setState` the effect reaches synchronously is a
  // cascading render, and the lint rule that says so is right here.
  const read = useCallback(
    (): Promise<State> =>
      summarizeLocalStore().then(
        (summary) => ({ status: "ready", summary }),
        () => ({ status: "failed" }),
      ),
    [],
  );

  useEffect(() => {
    let current = true;

    void read().then((next) => {
      if (current) setState(next);
    });

    return () => {
      current = false;
    };
  }, [read, refreshToken]);

  async function deleteEverything() {
    setIsDeleting(true);
    setError(null);

    try {
      await deleteEverythingLocal();
      setDeleted(true);
      setState(await read());
      onCleared?.();
      // Radix restores focus to the trigger, which this delete has just
      // disabled — `focus()` on a disabled button is a no-op and the caret
      // falls to <body>, so the next Tab restarts from the top of the page.
      summary.current?.focus();
      // Only on success. Left open, it would state a count that is no longer
      // true, over a confirmation the reader can no longer reach.
      setIsOpen(false);
    } catch {
      setError("Nothing was deleted. Reload the page and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Checking what is stored on this machine…
      </p>
    );
  }

  if (state.status === "failed") {
    return (
      <div role="alert" className="border-border rounded-md border p-4 text-sm">
        <p className="font-medium">
          Could not read this browser&rsquo;s storage.
        </p>
        <p className="text-muted-foreground mt-2">
          Local mode keeps documents in IndexedDB, which private browsing
          sometimes withholds.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void read().then(setState)}
        >
          Try again
        </Button>
      </div>
    );
  }

  const { documents, chunks, files } = state.summary;
  const isEmpty = documents === 0;

  return (
    <section
      aria-labelledby="local-storage"
      className="border-border rounded-md border p-4"
    >
      <h2 id="local-storage" className="text-sm font-medium">
        Stored on this machine
      </h2>

      {/* `status` rather than a bare `aria-live`: the count changing is the only
          confirmation a screen reader gets that the deletion happened. */}
      <p
        ref={summary}
        tabIndex={-1}
        role="status"
        className="text-muted-foreground mt-2 text-sm outline-none"
      >
        {isEmpty
          ? deleted
            ? "Deleted. Nothing from local mode remains in this browser."
            : "Nothing yet. Documents you add in local mode are kept in this browser and never uploaded."
          : `${count(documents, "document")} and ${count(chunks, "passage")}, including the text and the embeddings.`}
      </p>

      {/* Outside the live region above: naming the files is useful on arrival,
          and reading the whole list aloud after every delete is not. */}
      {isEmpty ? null : (
        <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
          {/* Keyed by id: the same file added twice is two stored documents,
              and its name is not an identity. */}
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2">
              <span aria-hidden="true">•</span>
              <span className="truncate">{file.filename}</span>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setError(null);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="destructive"
            className="mt-3"
            disabled={isEmpty}
          >
            Delete everything
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete everything stored locally?
            </AlertDialogTitle>
            {/* The counts, not "your data": a reader who cannot see what is about
                to go is being asked to confirm something they have not read. */}
            <AlertDialogDescription>
              This permanently removes {count(documents, "document")} and{" "}
              {count(chunks, "passage")} from this browser, including the
              extracted text and the embeddings. It cannot be undone, and
              nothing is kept anywhere else.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Inside the dialog, not on the page behind it: Radix marks that
              content `aria-hidden` while this is open, so an error rendered
              there is invisible exactly when it is needed. */}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* Not AlertDialogAction, which closes on click and would hide the
                error the user needs to see. */}
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void deleteEverything()}
            >
              {isDeleting ? "Deleting…" : "Delete everything"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
