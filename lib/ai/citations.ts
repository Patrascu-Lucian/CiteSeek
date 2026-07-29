import type { ChatSource } from "./types";

/**
 * Turning the markers a model writes into something clickable.
 *
 * The model emits `[1]` in ordinary prose. The client has to render that as a
 * chip without breaking the markdown around it — and markdown is rendered from a
 * string, not a React tree, so splitting the text on markers first would cut
 * emphasis and lists in half.
 *
 * So a marker is rewritten as a markdown *link* before rendering, and the link
 * renderer draws the chip. The markdown parser does the hard part; the citation
 * layer only has to recognize its own hrefs.
 */

/** Fragment links survive markdown sanitization; a custom URI scheme would not. */
export const CITATION_HREF_PREFIX = "#citation-";

/**
 * One or more marker numbers in a single bracket: `[1]`, `[1, 2]`, `[1,2,3]`.
 *
 * Grouped markers are not hypothetical. Told that a sentence drawn from several
 * passages carries several markers, the model writes `[1, 2]` — which a
 * single-number pattern misses entirely, leaving the citation as dead text in an
 * answer that otherwise looks correct. Observed in production before it was
 * matched here.
 *
 * The negative lookahead leaves `[1](https://…)` alone: text that is already a
 * markdown link is not a citation marker.
 */
const GROUPED_MARKER = /\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g;

/**
 * Rewrites `[n]` as `[n](#citation-n)`, but only for markers that resolve.
 *
 * A marker with no matching source is left as literal text. That is the whole
 * anti-hallucination property made visible: if the model invents `[7]` when only
 * three passages were retrieved, there is nothing to link to, so nothing renders
 * as a chip. It cannot produce a citation that looks real and goes nowhere.
 */
export function linkCitationMarkers(
  text: string,
  sources: readonly ChatSource[],
): string {
  if (sources.length === 0) return text;

  const known = new Set(sources.map((source) => source.marker));

  return text.replace(GROUPED_MARKER, (whole, group: string) => {
    const markers = group.split(",").map((part) => Number(part.trim()));

    // All or nothing. A group where one number resolves and another does not is
    // a model that has half-invented a citation; rendering the valid half would
    // quietly drop the invented one and make the answer look better sourced than
    // it is. Left as literal text, which is what an unresolvable marker has
    // always done.
    if (!markers.every((marker) => known.has(marker))) return whole;

    // Emitted as adjacent links rather than one, because a link points at a
    // single source. `[1, 2]` becomes two chips, and the separator goes with it.
    return markers
      .map((marker) => `[${marker}](${CITATION_HREF_PREFIX}${marker})`)
      .join("");
  });
}

/** The marker a citation href points at, or null if it is an ordinary link. */
export function parseCitationHref(href: string | undefined): number | null {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) return null;

  const marker = Number(href.slice(CITATION_HREF_PREFIX.length));

  return Number.isInteger(marker) && marker > 0 ? marker : null;
}

/** The label a screen reader hears instead of a bare number. */
export function citationLabel(source: ChatSource): string {
  const page = source.pageNumber === null ? "" : `, page ${source.pageNumber}`;

  return `Citation ${source.marker}: ${source.filename}${page}`;
}
