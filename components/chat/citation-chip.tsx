import type { ComponentPropsWithoutRef } from "react";

import { citationLabel, parseCitationHref } from "@/lib/ai/citations";
import { cn } from "@/lib/utils";

import { useCitations } from "./citation-context";
import { InertLink } from "./safe-markdown";

/**
 * A numbered marker, rendered inline in the answer.
 *
 * A button rather than a link: it opens a panel beside the conversation instead
 * of navigating, and a link that does not navigate is a lie to anyone using a
 * screen reader or a middle click.
 *
 * The accessible name carries the filename and page, because "1" read aloud on
 * its own tells you nothing about what you are about to open.
 */

/**
 * Stands in for `<a>` in rendered markdown.
 *
 * Every link passes through here, and exactly one kind survives as something
 * clickable: a citation href with a passage behind it. A citation marker with no
 * matching source becomes plain text — there is nothing to open, so nothing may
 * look openable. Anything else the model wrote is rendered inert by `InertLink`,
 * because an answer is untrusted output and a link inside one is a destination
 * the reader has no way to vouch for.
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
        "mx-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 align-baseline text-xs font-medium tabular-nums transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
        // `bg-background` with a ring, not `bg-muted`. The assistant bubble is
        // itself `bg-muted`, so a muted chip was drawn in exactly the color
        // behind it: the pill was invisible and the markers read as stray gray
        // numbers with an unexplained gap, which was its padding. Contrast has
        // to be against the bubble, not against the page.
        isSelected
          ? "bg-primary text-primary-foreground ring-primary ring-1"
          : "bg-background text-foreground ring-border hover:bg-accent ring-1",
      )}
    >
      {source.marker}
    </button>
  );
}
