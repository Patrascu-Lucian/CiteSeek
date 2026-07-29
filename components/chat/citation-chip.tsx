import type { ComponentPropsWithoutRef } from "react";

import { citationLabel, parseCitationHref } from "@/lib/ai/citations";
import { cn } from "@/lib/utils";

import { useCitations } from "./citation-context";

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
 * Every link passes through here. Citation hrefs become chips; anything else the
 * model wrote stays an ordinary link, including a marker whose number has no
 * passage behind it — there is nothing to open, so nothing may look openable.
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
    return (
      <a href={href} rel="noreferrer noopener" {...props}>
        {children}
      </a>
    );
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
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
      )}
    >
      {source.marker}
    </button>
  );
}
