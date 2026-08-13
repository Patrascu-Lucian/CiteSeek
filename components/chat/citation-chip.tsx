import type { ComponentPropsWithoutRef } from "react";

import { citationLabel, parseCitationHref } from "@/lib/ai/citations";
import { cn } from "@/lib/utils";

import { useCitations } from "./citation-context";
import { InertLink } from "./safe-markdown";

/** A button, not a link: it opens a panel rather than navigating, and a link that
 * does not navigate lies to a screen reader and a middle click. The accessible
 * name carries filename and page — "1" read aloud says nothing. */

/**
 * Every rendered link passes through here and exactly one kind stays clickable: a
 * citation href with a passage behind it. A marker with no matching source
 * becomes plain text — nothing to open, so nothing may look openable. Everything
 * else is inert, since an answer is untrusted output.
 */
export function CitationLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const { sources, selectedChunkId, onSelect } = useCitations();

  const marker = parseCitationHref(href);
  const source =
    marker === null
      ? undefined
      : sources.find((candidate) => candidate.marker === marker);

  if (!source) {
    // A citation href we could not resolve: show the text, drop the anchor.
    if (marker !== null) return <span {...props}>{children}</span>;

    return <InertLink href={href}>{children}</InertLink>;
  }

  const isSelected = source.chunkId === selectedChunkId;

  return (
    <button
      type="button"
      onClick={() => onSelect(source)}
      aria-label={citationLabel(source)}
      aria-pressed={isSelected}
      className={cn(
        "mx-0.5 inline-flex min-w-6 items-center justify-center rounded-md px-1 align-baseline text-xs font-medium tabular-nums transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
        // `bg-background` with a ring, not `bg-muted`: the assistant bubble is
        // itself `bg-muted`, so the pill was invisible and markers read as stray
        // numbers. Contrast is against the bubble, not the page.
        isSelected
          ? "bg-primary text-primary-foreground ring-primary ring-1"
          : "bg-background text-foreground ring-border hover:bg-accent ring-1",
      )}
    >
      {/*
        Bracketed, not bare. A chip is inline in prose, and a bare numeral is
        readable as part of the sentence: a 0.5B model answered "Employees
        receive [1] days of annual leave" about a document saying 28, and it
        rendered as "Employees receive 1 days" — a wrong number wearing a working
        citation, given away only by the grammar. Brackets cannot be read as a
        quantity, and they are what the model was asked to write. They also
        survive being copied, where two adjacent chips used to flatten into "35".
      */}
      [{source.marker}]
    </button>
  );
}
