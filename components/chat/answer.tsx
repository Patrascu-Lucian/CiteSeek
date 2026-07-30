import { useMemo } from "react";
import { Streamdown } from "streamdown";

import { linkCitationMarkers } from "@/lib/ai/citations";
import type { ChatSource } from "@/lib/ai/types";

import { CitationLink } from "./citation-chip";
import { CitationProvider } from "./citation-context";
import { InertImage, SemanticEmphasis, SemanticStrong } from "./safe-markdown";

/**
 * An assistant answer: markdown, with citation markers rendered as chips.
 *
 * `Streamdown` rather than a plain markdown renderer because this text arrives a
 * token at a time, and half-written markdown is the normal state rather than an
 * error. A renderer that meets `**bold` mid-stream shows the asterisks and then
 * reflows when the closing pair lands; this one holds the incomplete construct
 * until it resolves.
 *
 * Markers are rewritten into markdown links before parsing and intercepted at
 * the link renderer — see `lib/ai/citations.ts` for why that beats splitting the
 * text, and `citation-context.tsx` for why the state travels by context.
 */

/**
 * Module-level, so its identity never changes. `Streamdown` memoizes on a
 * comparator that ignores `components`, so a fresh object each render would be
 * quietly discarded anyway — this makes that explicit rather than accidental.
 *
 * `img` is overridden rather than left to the renderer: an image in an answer is
 * a network request the browser makes on render with no click, which is an
 * exfiltration channel out of the workspace. See `safe-markdown.tsx`.
 */
const MARKDOWN_COMPONENTS = {
  a: CitationLink,
  img: InertImage,
  strong: SemanticStrong,
  em: SemanticEmphasis,
} as const;

export function Answer({
  text,
  sources,
  onSelectSource,
  selectedChunkId,
}: {
  text: string;
  sources: readonly ChatSource[];
  onSelectSource: (source: ChatSource) => void;
  selectedChunkId: string | null;
}) {
  const citations = useMemo(
    () => ({ sources, selectedChunkId, onSelect: onSelectSource }),
    [sources, selectedChunkId, onSelectSource],
  );

  return (
    <CitationProvider value={citations}>
      <Streamdown
        parseIncompleteMarkdown
        className="prose-sm max-w-none [&_ol]:list-decimal [&_ol,&_ul]:my-2 [&_ol,&_ul]:pl-5 [&_p]:my-2 [&_ul]:list-disc"
        components={MARKDOWN_COMPONENTS}
      >
        {linkCitationMarkers(text, sources)}
      </Streamdown>
    </CitationProvider>
  );
}
