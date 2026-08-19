import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RefusalReason } from "@/lib/ai/types";

/**
 * What a reader is offered when their question could not be grounded. Two
 * alternatives rejected in ADR 017: a document about the product would be
 * self-referential text in the corpus, and a second ungrounded path would give
 * the model somewhere to answer from that is not the documents.
 *
 * **Every word here is ours, none a model's** — an ungrounded turn must not
 * produce prose that reads as if it had been grounded.
 */
export function Refusal({
  reason,
  documents,
  canUpload,
  signedIn,
  uploadHref,
}: {
  reason: RefusalReason;
  /** Filenames of what is searchable now — not what was searchable when the
   *  refusal was streamed, so a document uploaded since shows up here. */
  documents: readonly string[];
  canUpload: boolean;
  signedIn: boolean;
  /** Where the upload area lives. Null when it is already on this page, which
   * is local mode: a link to where the reader already is helps nobody. */
  uploadHref: string | null;
}) {
  const nothingIndexed = reason === "no_documents" || documents.length === 0;

  return (
    <div
      data-refusal={reason}
      className="border-border/60 mt-3 space-y-3 rounded-md border border-dashed p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <FileQuestion aria-hidden="true" className="size-4 shrink-0" />
        {nothingIndexed
          ? "There is nothing to search yet"
          : "What I can answer from"}
      </p>

      {/* Not "in this workspace": local mode has none, and this is the first
          sentence a reader sees there before anything is indexed. */}
      {nothingIndexed ? (
        <p className="text-muted-foreground text-sm">
          Answers come only from the documents available here, and none have
          finished processing.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Only these documents — I have no knowledge outside them, including
            about this app itself.
          </p>
          {/* A list, not a sentence: it is a list, and a screen reader
              announces how many there are. */}
          {/* Deduplicated: nothing stops the same file being uploaded twice, and
              naming it twice tells the reader nothing — as well as producing two
              children under one key. */}
          <ul className="space-y-1 text-sm">
            {[...new Set(documents)].map((filename) => (
              <li key={filename} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-muted-foreground">
                  •
                </span>
                <span className="truncate">{filename}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            If the answer should be in one of them, try naming the section or
            using the wording the document uses.
          </p>
        </>
      )}

      <Affordance
        canUpload={canUpload}
        signedIn={signedIn}
        uploadHref={uploadHref}
      />
    </div>
  );
}

/**
 * What to do next, mirroring the read-only card in `WorkspaceSections`: a reader
 * who cannot upload is never told to. A writer needs no link either — the
 * dropzone is already above the conversation.
 */
function Affordance({
  canUpload,
  signedIn,
  uploadHref,
}: {
  canUpload: boolean;
  signedIn: boolean;
  /** Where the upload area lives. Null when it is already on this page, which
   * is local mode: a link to where the reader already is helps nobody. */
  uploadHref: string | null;
}) {
  if (canUpload) {
    return (
      <p className="text-muted-foreground text-sm">
        Or add the document that has the answer — the upload area is at the top
        of{" "}
        {uploadHref === null ? (
          "this page"
        ) : (
          <Link href={uploadHref} className="underline">
            this workspace
          </Link>
        )}
        .
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        {signedIn
          ? "This workspace is read-only. Your own is where you can upload documents."
          : "This is a shared demo, so it is read-only."}
      </p>
      <Button asChild size="sm" variant="outline">
        <Link
          href={signedIn ? "/w" : "/sign-in"}
          prefetch={signedIn ? false : undefined}
        >
          {signedIn ? "Go to your workspace" : "Sign in to upload your own"}
        </Link>
      </Button>
    </div>
  );
}
