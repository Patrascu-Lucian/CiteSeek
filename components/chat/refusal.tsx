import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RefusalReason } from "@/lib/ai/types";

/**
 * What a reader is offered when their question could not be grounded.
 *
 * The problem this exists for: "how do I upload a file?" is a reasonable thing
 * to type into a chat box, and it is refused, because the answer is not in
 * anyone's documents. The refusal was correct and useless — it said nothing had
 * been found and left the reader to guess whether the product was broken.
 *
 * Three things were considered and two rejected (ADR 017). Seeding a document
 * about the product would put self-referential text in the corpus, where it can
 * be retrieved and cited as though it were the reader's own content. A second,
 * ungrounded answering path would give the model somewhere to answer from that
 * is not the documents, which is the guarantee the whole design rests on.
 *
 * What is left is this: say what the assistant can answer from, and point at the
 * interface. **Every word here is written by us, none by a model** — a turn that
 * could not be grounded must not produce prose that reads as if it had been.
 */
export function Refusal({
  reason,
  documents,
  canUpload,
  signedIn,
  workspaceId,
}: {
  reason: RefusalReason;
  /** Filenames of what is searchable now — not what was searchable when the
   *  refusal was streamed, so a document uploaded since shows up here. */
  documents: readonly string[];
  canUpload: boolean;
  signedIn: boolean;
  workspaceId: string;
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

      {nothingIndexed ? (
        <p className="text-muted-foreground text-sm">
          Answers here come only from documents in this workspace, and none have
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
          <ul className="space-y-1 text-sm">
            {documents.map((filename) => (
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

      {/*
        The affordance mirrors the read-only card in `WorkspaceSections`: a
        reader who cannot upload is not told to, because that is an instruction
        they are unable to follow.
      */}
      <Affordance
        canUpload={canUpload}
        signedIn={signedIn}
        workspaceId={workspaceId}
      />
    </div>
  );
}

/**
 * What to do next, which depends entirely on who is reading.
 *
 * Mirrors the read-only card in `WorkspaceSections`: someone who cannot upload
 * here is never told to, because that is an instruction they are unable to
 * follow. A writer needs no link — the dropzone is already on this page, above
 * the conversation — so they get a sentence pointing at it rather than a button
 * navigating them to where they already are.
 */
function Affordance({
  canUpload,
  signedIn,
  workspaceId,
}: {
  canUpload: boolean;
  signedIn: boolean;
  workspaceId: string;
}) {
  if (canUpload) {
    return (
      <p className="text-muted-foreground text-sm">
        Or add the document that has the answer — the upload area is at the top
        of{" "}
        <Link href={`/w/${workspaceId}`} className="underline">
          this workspace
        </Link>
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
        <Link href={signedIn ? "/w" : "/sign-in"}>
          {signedIn ? "Go to your workspace" : "Sign in to upload your own"}
        </Link>
      </Button>
    </div>
  );
}
