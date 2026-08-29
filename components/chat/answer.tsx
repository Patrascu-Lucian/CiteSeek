import { useMemo } from "react";
import { Streamdown } from "streamdown";
import { AlertTriangle } from "lucide-react";

import {
  citedMarkers,
  linkCitationMarkers,
  unresolvedMarkers,
} from "@/lib/ai/citations";
import type { ChatSource } from "@/lib/ai/types";

import { CitationLink } from "./citation-chip";
import { CitationProvider } from "./citation-context";
import { InertImage, SemanticEmphasis, SemanticStrong } from "./safe-markdown";

/**
 * `Streamdown` rather than a plain renderer: text arrives a token at a time, so
 * half-written markdown is the normal state. A plain renderer shows `**bold`'s
 * asterisks then reflows when the pair lands; this holds the construct until it
 * resolves.
 *
 * Markers become markdown links before parsing and are intercepted at the link
 * renderer — see `lib/ai/citations.ts`.
 */

/** Module-level: `Streamdown` memoizes on a comparator ignoring `components`, so
 * a fresh object each render is discarded anyway. `img` is overridden because an
 * image is a no-click network request — see `safe-markdown.tsx`. */
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
  settled = true,
}: {
  text: string;
  sources: readonly ChatSource[];
  onSelectSource: (source: ChatSource) => void;
  selectedChunkId: string | null;
  /** False while this answer is still streaming. Every answer cites nothing
   * before its first marker arrives, so the note below would flash on all of
   * them. Defaults true: a message being re-rendered from history is finished. */
  settled?: boolean;
}) {
  const citations = useMemo(
    () => ({ sources, selectedChunkId, onSelect: onSelectSource }),
    [sources, selectedChunkId, onSelectSource],
  );

  const invented = unresolvedMarkers(text, sources);
  const groundless =
    settled &&
    sources.length > 0 &&
    text.trim().length > 0 &&
    // No invented ones either: an answer citing `[7]` already gets the note
    // above, and two warnings for one situation is how both stop being read.
    invented.length === 0 &&
    citedMarkers(text, sources).length === 0;

  return (
    <CitationProvider value={citations}>
      {/* Read by `scripts/eval-local-markers.mts`: the notices below sit inside
          the bubble, and it must not record them as the model's words. */}
      <div data-answer-prose="">
        <Streamdown
          parseIncompleteMarkdown
          className="prose-sm max-w-none [&_ol]:list-decimal [&_ol,&_ul]:my-2 [&_ol,&_ul]:pl-5 [&_p]:my-2 [&_ul]:list-disc"
          components={MARKDOWN_COMPONENTS}
        >
          {linkCitationMarkers(text, sources)}
        </Streamdown>
      </div>

      {invented.length > 0 ? <InventedMarkers markers={invented} /> : null}
      {groundless ? <NothingCited /> : null}
    </CitationProvider>
  );
}

/**
 * Passages were found, the model was called, and it pointed at none of them.
 *
 * States the fact and names both readings rather than judging between them: an
 * uncited refusal is correct under the system prompt's rule 4, an uncited claim
 * is the model's own invention, and nothing on this side can tell which one a
 * sentence is. Saying "unsupported" would be wrong half the time; saying what
 * happened is right every time (ADR 037).
 */
function NothingCited() {
  return (
    <p className="text-muted-foreground mt-2 flex gap-2 text-xs">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <strong>Nothing here is cited.</strong> A refusal is expected to cite
        nothing — anything else is the model&rsquo;s own words rather than your
        documents.
      </span>
    </p>
  );
}

/**
 * The inert marker, explained. Refusing to link an invented number is the
 * guarantee; saying nothing about it is what made the author of that rule report
 * it as a broken button (ADR 036).
 */
function InventedMarkers({ markers }: { markers: readonly number[] }) {
  const list = markers.map((marker) => `[${String(marker)}]`).join(", ");
  const one = markers.length === 1;

  return (
    <p className="text-muted-foreground mt-2 flex gap-2 text-xs">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <strong>{list}</strong>{" "}
        {one
          ? "is not one of the passages found, so it is not a link. Treat that claim as unsupported."
          : "are not among the passages found, so they are not links. Treat those claims as unsupported."}
      </span>
    </p>
  );
}
