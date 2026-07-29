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
 * Rewrites `[n]` as `[n](#citation-n)`, but only for markers that resolve.
 *
 * A marker with no matching source is left as literal text. That is the whole
 * anti-hallucination property made visible: if the model invents `[7]` when only
 * three passages were retrieved, there is nothing to link to, so nothing renders
 * as a chip. It cannot produce a citation that looks real and goes nowhere.
 *
 * The negative lookahead leaves `[1](https://…)` alone — text that is already a
 * markdown link is not a citation marker.
 */
export function linkCitationMarkers(
  text: string,
  sources: readonly ChatSource[],
): string {
  if (sources.length === 0) return text;

  const known = new Set(sources.map((source) => source.marker));

  return text.replace(/\[(\d+)\](?!\()/g, (whole, digits: string) => {
    const marker = Number(digits);
    return known.has(marker)
      ? `[${digits}](${CITATION_HREF_PREFIX}${digits})`
      : whole;
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
