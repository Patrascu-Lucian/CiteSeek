import {
  AlertCircle,
  FileText,
  PanelRight,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { DocumentFailureReason } from "@/lib/db/schema";
import type { DocumentSummary } from "@/lib/documents/queries";

import { StatusBadge } from "./status-badge";

const FAILURE_COPY = {
  no_text: {
    sentence:
      "No text could be read from this file. A scanned PDF needs OCR before it can be searched.",
  },
  unreadable: {
    sentence:
      "This file could not be read. It may be damaged, password-protected or in an older format.",
  },
  too_large: {
    sentence:
      "This document is too long for one file here. Split it into smaller documents.",
  },
  // Not `storageExceededMessage`: it names the limit, which the list does not carry.
  over_storage: {
    sentence:
      "This document's text would take you past the storage limit. Delete another document, or upload a smaller one.",
  },
  embedding_unavailable: {
    sentence:
      "Some passages could not be indexed, usually a temporary limit at the model provider. Retry in a minute.",
  },
  interrupted: {
    sentence: "Processing stopped before it finished.",
    withoutRetry: "Delete it and upload the file again.",
  },
  unknown: {
    sentence: "Something went wrong while processing this document.",
    withoutRetry: "Delete it and upload the file again.",
  },
} as const satisfies Record<
  DocumentFailureReason,
  { sentence: string; withoutRetry?: string }
>;

function failureSentence(reason: DocumentFailureReason, canRetry: boolean) {
  const copy: { sentence: string; withoutRetry?: string } =
    FAILURE_COPY[reason];
  return !canRetry && copy.withoutRetry
    ? `${copy.sentence} ${copy.withoutRetry}`
    : copy.sentence;
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * Renders documents and their states. Owns no data.
 *
 * Fetching, polling and mutation live in `DocumentsPanel`, which is the single
 * owner of the list. Keeping this component presentational is what makes its
 * states — empty, processing, failed, read-only — testable by simply passing
 * them in, with no network to intercept.
 */
export function DocumentList({
  documents,
  canWrite,
  busyId,
  pollError,
  onRetry,
  onDelete,
  onOpen,
}: {
  documents: DocumentSummary[];
  canWrite: boolean;
  busyId?: string | null;
  pollError?: string | null;
  onRetry?: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
  onOpen?: (documentId: string, filename: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <div className="border-border/60 rounded-xl border px-4 py-10 text-center sm:px-6">
        <FileText
          aria-hidden="true"
          className="text-muted-foreground mx-auto size-6"
        />
        <p className="mt-3 font-medium">No documents yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {canWrite
            ? "Upload a PDF, Word document, Markdown or text file to get started."
            : "This workspace doesn't have any documents loaded yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pollError ? (
        <p role="status" className="text-muted-foreground text-sm">
          {pollError}
        </p>
      ) : null}

      {/* Polite, not assertive: status changes should not interrupt whatever a
          screen-reader user is currently reading. */}
      <ul aria-live="polite" className="space-y-2">
        {documents.map((document) => (
          <li
            key={document.id}
            className="border-border/60 has-[button:hover]:bg-muted/40 group/row relative flex flex-wrap items-center gap-3 rounded-lg border px-(--card-spacing) py-3"
          >
            <FileText
              aria-hidden="true"
              className="text-muted-foreground hidden size-4 shrink-0 sm:block"
            />

            <div className="min-w-0 flex-1">
              {onOpen && document.status === "ready" ? (
                // `::after` rather than a row-sized button: the delete button
                // would nest inside one.
                <button
                  type="button"
                  onClick={() => {
                    onOpen(document.id, document.filename);
                  }}
                  className="focus-visible:ring-ring flex w-full items-center gap-1.5 rounded-sm text-left font-medium after:absolute after:inset-0 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {/* `min-w-0`, or a flex child never shrinks below its text and
                      `truncate` does nothing. */}
                  <span className="min-w-0 truncate">{document.filename}</span>
                  {/* Not decoration: on a touch screen this is the row's only
                      signal that it opens anything. */}
                  <PanelRight
                    aria-hidden="true"
                    className="text-muted-foreground group-hover/row:text-foreground size-3.5 shrink-0"
                  />
                </button>
              ) : (
                <p className="truncate font-medium">{document.filename}</p>
              )}
              <p className="text-muted-foreground mt-0.5 text-sm">
                {document.status === "ready" && document.chunkCount
                  ? `${count(document.chunkCount, "passage")}${document.pageCount ? ` · ${count(document.pageCount, "page")}` : ""}`
                  : document.status === "failed"
                    ? null
                    : "Waiting to be processed"}
              </p>

              {document.failureReason ? (
                <p className="text-destructive mt-1 flex items-start gap-1.5 text-sm">
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                  {failureSentence(document.failureReason, document.canRetry)}
                </p>
              ) : null}
            </div>

            {/* No `z-10` here, or the badge would sit above the row-sized
                target and swallow the click. */}
            <div className="flex items-center gap-1">
              <StatusBadge
                status={document.status}
                embedded={document.embeddedChunkCount}
                total={document.chunkCount}
              />

              {canWrite ? (
                <div className="relative z-10 flex items-center gap-1">
                  {document.canRetry ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === document.id}
                      onClick={() => onRetry?.(document.id)}
                    >
                      <RotateCcw aria-hidden="true" className="size-4" />
                      Retry
                    </Button>
                  ) : null}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost-destructive"
                        size="icon-sm"
                        disabled={busyId === document.id}
                        aria-label={`Delete ${document.filename}`}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete {document.filename}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the document, its extracted text and
                          every passage indexed from it. It cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete?.(document.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
