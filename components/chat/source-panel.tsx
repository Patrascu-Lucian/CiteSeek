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
 * The source document, opened at the passage an answer cited.
 *
 * This panel is the point of the whole milestone. Everything upstream — the
 * offsets recorded during chunking, the anchors carried through retrieval, the
 * marker the model wrote — exists so that clicking `[1]` lands here, on the
 * exact text the claim came from. Until this renders, a citation is a promise.
 *
 * The whole document is shown rather than the passage alone, because a citation
 * you cannot read around is not much better than no citation: the surrounding
 * paragraph is often what tells you whether the answer used it fairly.
 */

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; contentText: string }
  /** The document is gone, or its text was never stored. */
  | { status: "unavailable"; reason: "deleted" | "no-text" }
  | { status: "error" };

export function SourcePanel({
  source,
  workspaceId,
  onClose,
}: {
  source: ChatSource | null;
  workspaceId: string;
  onClose: () => void;
}) {
  if (!source) return null;

  return (
    /*
      Non-modal, deliberately.

      A modal sheet dims and hides the conversation behind it — which defeats the
      point of opening a source. Checking a citation means reading the claim and
      the passage together, so the answer has to stay visible and the reader has
      to be able to move between them.

      What is given up is the focus *trap*, which was never wanted here. Radix
      still moves focus into the panel on open and restores it on close, and
      Escape still dismisses. Clicking outside deliberately does not — a
      reference panel that vanishes when you click back into the conversation
      would be unusable.
    */
    <Sheet open modal={false} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        overlay={false}
        aria-describedby={undefined}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{source.filename}</SheetTitle>
          <SheetDescription>
            {source.pageNumber === null
              ? `Cited as [${source.marker}]`
              : `Cited as [${source.marker}] · page ${source.pageNumber}`}
          </SheetDescription>
        </SheetHeader>

        {/*
          Keyed by document, so opening a citation from a different source
          remounts with a fresh loading state. The alternative — resetting state
          from inside the fetch effect — is the pattern React now warns about,
          and a key says the same thing without a render's worth of stale text.
        */}
        <SourceBody
          key={source.documentId}
          source={source}
          workspaceId={workspaceId}
        />
      </SheetContent>
    </Sheet>
  );
}

function SourceBody({
  source,
  workspaceId,
}: {
  source: ChatSource;
  workspaceId: string;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const markRef = useRef<HTMLElement>(null);

  const { documentId } = source;

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
  }, [state.status, source.chunkId]);

  const highlight =
    state.status === "loaded"
      ? highlightForCitation(state.contentText, source)
      : null;

  return (
    /*
      Focusable, because it scrolls.

      A document is usually longer than the panel, and this region contains no
      focusable children — the passage is text. Without a tab stop of its own a
      keyboard-only reader can open a citation and then be unable to scroll to
      the rest of the document: arrow keys need something focused to act on.
      Caught by axe (`scrollable-region-focusable`, serious), on the product's
      headline feature.

      `role="region"` with a name rather than a bare `tabIndex`: an unnamed tab
      stop is a place focus lands with nothing announced, which trades one
      problem for another.
    */
    <div
      role="region"
      aria-label={`Source text of ${source.filename}`}
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
          <StoredQuote quote={source.quote} />
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
          <p className="text-muted-foreground mt-1">
            The passage the answer quoted was saved with the citation:
          </p>
          <StoredQuote quote={source.quote} />
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
                <StoredQuote quote={source.quote} />
              </div>
            </div>
          ) : null}

          {/*
            One text node per region rather than a virtualized list. A document
            is a few hundred kilobytes at most, the browser renders it once, and
            it is scrolled once — virtualization would break both the
            highlight's scroll target and find-in-page.
          */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {highlight.before}
            <mark
              ref={markRef}
              className="bg-primary/20 text-foreground rounded-sm px-0.5"
            >
              {highlight.cited}
            </mark>
            {highlight.after}
          </p>
        </>
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
