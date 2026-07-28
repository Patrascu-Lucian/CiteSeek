"use client";

import { AlertCircle, FileText, RotateCcw, Trash2 } from "lucide-react";

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
import type { DocumentSummary } from "@/lib/documents/queries";

import { StatusBadge } from "./status-badge";

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
}: {
  documents: DocumentSummary[];
  canWrite: boolean;
  busyId?: string | null;
  pollError?: string | null;
  onRetry?: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <div className="border-border/60 rounded-xl border px-6 py-10 text-center">
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
            className="border-border/60 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
          >
            <FileText
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{document.filename}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {document.status === "ready" && document.chunkCount
                  ? `${document.chunkCount} passages${document.pageCount ? ` · ${document.pageCount} pages` : ""}`
                  : document.status === "failed"
                    ? null
                    : "Waiting to be processed"}
              </p>

              {document.status === "failed" && document.error ? (
                <p className="text-destructive mt-1 flex items-start gap-1.5 text-sm">
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                  {document.error}
                </p>
              ) : null}
            </div>

            <StatusBadge
              status={document.status}
              embedded={document.embeddedChunkCount}
              total={document.chunkCount}
            />

            {canWrite ? (
              <div className="flex items-center gap-1">
                {document.status === "failed" ? (
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
                      variant="ghost"
                      size="sm"
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
                        This removes the document, its extracted text and every
                        passage indexed from it. It cannot be undone.
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
          </li>
        ))}
      </ul>
    </div>
  );
}
