import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileWarning, Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ChatSource } from "@/lib/ai/types";
import { highlightForCitation } from "@/lib/rag/highlight";

/**
 * A document, opened either at a cited passage or from the top. The whole text
 * either way: the paragraph around a citation is what tells you whether the
 * answer used it fairly, and a reader browsing the list wants the rest anyway.
 */

export type SourceTarget =
  | { kind: "citation"; source: ChatSource }
  | { kind: "document"; documentId: string; filename: string };

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; contentText: string }
  /** The document is gone, or its text was never stored. */
  | { status: "unavailable"; reason: "deleted" | "no-text" }
  | { status: "error" };

export function SourcePanel({
  target,
  workspaceId,
  onClose,
}: {
  target: SourceTarget | null;
  workspaceId: string;
  onClose: () => void;
}) {
  if (!target) return null;

  const filename =
    target.kind === "citation" ? target.source.filename : target.filename;
  const documentId =
    target.kind === "citation" ? target.source.documentId : target.documentId;

  return (
    /*
      Non-modal: checking a citation means reading the claim and the passage
      together, and a modal sheet dims the conversation behind it. What that
      gives up is the focus trap, which was never wanted — Radix still moves
      focus in, restores it, and dismisses on Escape. Outside clicks deliberately
      do not dismiss, or the panel would vanish on the way back to the answer.
    */
    <Sheet open modal={false} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        overlay={false}
        aria-describedby={undefined}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{filename}</SheetTitle>
          <SheetDescription>
            {target.kind === "document"
              ? "The full text, as it was extracted"
              : target.source.pageNumber === null
                ? `Cited as [${target.source.marker}]`
                : `Cited as [${target.source.marker}] · page ${target.source.pageNumber}`}
          </SheetDescription>
        </SheetHeader>

        {/* Keyed by document so a citation from another source remounts clean,
          rather than resetting state inside the fetch effect and rendering one
          frame of the previous document's text. */}
        <SourceBody
          key={documentId}
          target={target}
          workspaceId={workspaceId}
        />
      </SheetContent>
    </Sheet>
  );
}

function SourceBody({
  target,
  workspaceId,
}: {
  target: SourceTarget;
  workspaceId: string;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const markRef = useRef<HTMLElement>(null);

  const source = target.kind === "citation" ? target.source : null;
  const documentId =
    target.kind === "citation" ? target.source.documentId : target.documentId;

  useEffect(() => {
    // Guards a slow response for a citation the reader has already replaced
    // from overwriting the newer one.
    let current = true;

    void (async () => {
      try {
        const response = await fetch(
          `/api/w/${workspaceId}/documents/${documentId}`,
        );

        if (!current) return;

        if (response.status === 404) {
          setState({ status: "unavailable", reason: "deleted" });
          return;
        }
        if (!response.ok) {
          setState({ status: "error" });
          return;
        }

        const payload = (await response.json()) as {
          document: { contentText: string | null };
        };

        if (!current) return;

        setState(
          payload.document.contentText
            ? { status: "loaded", contentText: payload.document.contentText }
            : { status: "unavailable", reason: "no-text" },
        );
      } catch {
        if (current) setState({ status: "error" });
      }
    })();

    return () => {
      current = false;
    };
  }, [documentId, workspaceId]);

  // Scrolls once the highlight exists, not when the panel opens: the text has to
  // be in the DOM before there is anything to scroll to.
  useEffect(() => {
    if (state.status !== "loaded") return;

    markRef.current?.scrollIntoView({ block: "center" });
  }, [state.status, source?.chunkId]);

  const highlight =
    state.status === "loaded" && source
      ? highlightForCitation(state.contentText, source)
      : null;

  const plain = state.status === "loaded" && !source ? state.contentText : null;

  return (
    /*
      Scrolls, and holds no focusable children — so without a tab stop of its own
      a keyboard-only reader cannot reach the rest of the document. Caught by axe
      as `scrollable-region-focusable`. Named `role="region"` rather than a bare
      `tabIndex`, which would be a stop that announces nothing.
    */
    <div
      role="region"
      aria-label={`Source text of ${target.kind === "citation" ? target.source.filename : target.filename}`}
      tabIndex={0}
      className="focus-visible:ring-ring flex-1 overflow-y-auto px-6 py-4 focus-visible:ring-2 focus-visible:outline-none"
    >
      {state.status === "loading" ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Loading the source…
        </p>
      ) : null}

      {state.status === "error" ? (
        <div role="alert" className="text-sm">
          <p className="font-medium">This source couldn&apos;t be loaded.</p>
          <p className="text-muted-foreground mt-1">
            The passage the answer quoted is below, so you can still read it.
          </p>
          {source ? <StoredQuote quote={source.quote} /> : null}
        </div>
      ) : null}

      {state.status === "unavailable" ? (
        <div className="text-sm">
          <p className="flex items-center gap-2 font-medium">
            <FileWarning aria-hidden="true" className="size-4" />
            {state.reason === "deleted"
              ? "This document has been deleted."
              : "This document's text is no longer stored."}
          </p>
          {source ? (
            <>
              <p className="text-muted-foreground mt-1">
                The passage the answer quoted was saved with the citation:
              </p>
              <StoredQuote quote={source.quote} />
            </>
          ) : null}
        </div>
      ) : null}

      {highlight ? (
        <>
          {!highlight.matchesQuote ? (
            <div
              role="alert"
              className="border-border bg-muted/50 mb-4 flex gap-2 rounded-md border p-3 text-sm"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div>
                <p className="font-medium">
                  This document has changed since the answer was written.
                </p>
                <p className="text-muted-foreground mt-1">
                  The highlight below may not be the passage that was cited.
                  What the answer quoted was:
                </p>
                {source ? <StoredQuote quote={source.quote} /> : null}
              </div>
            </div>
          ) : null}

          {/* Not virtualized: a document is a few hundred kilobytes at most, and
            windowing would break both the scroll target and find-in-page. */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {highlight.before}
            {/* Underlined as well as tinted: the tint alone carried the whole
              claim in color, which is the one thing a highlight must not do. */}
            <mark
              ref={markRef}
              className="bg-primary/30 text-foreground decoration-primary rounded-sm box-decoration-clone px-0.5 underline decoration-2 underline-offset-4"
            >
              {highlight.cited}
            </mark>
            {highlight.after}
          </p>
        </>
      ) : null}

      {plain ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{plain}</p>
      ) : null}
    </div>
  );
}

function StoredQuote({ quote }: { quote: string }) {
  return (
    <blockquote className="border-border text-muted-foreground mt-2 border-l-2 pl-3 text-sm">
      {quote}
    </blockquote>
  );
}
