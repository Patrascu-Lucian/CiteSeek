import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RefusalReason } from "@/lib/ai/types";

type Panel = "nothing_indexed" | "nothing_matched" | "model_mismatch";

// A record rather than a boolean: a new reason fails to compile here instead of
// rendering one of the others' copy.
const PANEL_FOR: Record<RefusalReason, Panel> = {
  no_documents: "nothing_indexed",
  no_relevant_passages: "nothing_matched",
  embedding_model_mismatch: "model_mismatch",
};

const HEADING: Record<Panel, string> = {
  nothing_indexed: "There is nothing to search yet",
  nothing_matched: "What I can answer from",
  model_mismatch: "The documents here cannot be searched right now",
};

/** What a reader is offered when their question could not be grounded; two
 * alternatives rejected in ADR 017. **Every word here is ours, none a model's**
 * — an ungrounded turn must not read as if it had been grounded. */
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
  const panel = documents.length === 0 ? "nothing_indexed" : PANEL_FOR[reason];

  return (
    <div
      data-refusal={reason}
      className="border-border/60 mt-3 space-y-3 rounded-md border border-dashed p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <FileQuestion aria-hidden="true" className="size-4 shrink-0" />
        {HEADING[panel]}
      </p>

      {/* Not "in this workspace": local mode has none, and this is the first
          sentence a reader sees there before anything is indexed. */}
      {panel === "nothing_indexed" && (
        <p className="text-muted-foreground text-sm">
          Answers come only from the documents available here, and none have
          finished processing.
        </p>
      )}

      {panel === "model_mismatch" && (
        <p className="text-muted-foreground text-sm">
          They are stored, but they were indexed by a different search model
          than the one running now, so none of them can be matched to a question
          until they are indexed again. That is a fix on our side — there is
          nothing to upload again.
        </p>
      )}

      {panel === "nothing_matched" && (
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
            using the wording the document uses. A short follow-up is the usual
            cause — “how much?” carries nothing to search for, so naming its
            subject again is what fixes it.
          </p>
        </>
      )}

      {/* None after a mismatch: the answer is most likely in a document already
          here, and uploading it again would count it twice against the cap. */}
      {panel !== "model_mismatch" && (
        <Affordance
          canUpload={canUpload}
          signedIn={signedIn}
          uploadHref={uploadHref}
        />
      )}
    </div>
  );
}

/**
 * What to do next, mirroring the read-only card in `WorkspaceShell`: a reader
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
