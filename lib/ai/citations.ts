import type { ChatSource } from "./types";

/**
 * Turning the markers a model writes into something clickable.
 *
 * Markdown renders from a string, not a React tree, so splitting text on markers
 * would cut emphasis and lists in half. Instead a marker is rewritten as a
 * markdown *link* before rendering, and the link renderer draws the chip.
 */

/** Fragment links survive markdown sanitization; a custom URI scheme would not. */
export const CITATION_HREF_PREFIX = "#citation-";

/**
 * A run of markers: `[1]`, `[1, 2]`, `[1][2]`.
 *
 * Both spellings were observed on the deployed app — told several passages mean
 * several markers the model wrote `[1, 2]`, told to separate them it wrote
 * `[1][2]`. Matching the whole run means the separator between chips is chosen
 * here rather than inherited: on screen they look the same either way, but
 * **copied as text** adjacent chips flatten into "35", a marker that cannot
 * exist.
 *
 * The negative lookahead leaves `[1](https://…)` alone.
 */
const GROUPED_MARKER = /(?:\[\d+(?:\s*,\s*\d+)*])+(?!\()/g;

const MARKER_NUMBER = /\d+/g;

/**
 * Rewrites `[n]` as `[n](#citation-n)`, but only for markers that resolve.
 *
 * An unresolvable marker stays literal text — the anti-hallucination property
 * made visible. Invent `[7]` when three passages were retrieved and there is
 * nothing to link to, so nothing renders as a chip.
 */
export function linkCitationMarkers(
  text: string,
  sources: readonly ChatSource[],
): string {
  if (sources.length === 0) return text;

  const known = new Set(sources.map((source) => source.marker));

  return text.replace(GROUPED_MARKER, (whole) => {
    const markers = (whole.match(MARKER_NUMBER) ?? []).map(Number);

    // All or nothing: rendering the valid half of a half-invented group would
    // quietly drop the invented one and make the answer look better sourced.
    if (!markers.every((marker) => known.has(marker))) return whole;

    // Space-separated, so the distinction survives being copied out of the page.
    return markers
      .map((marker) => `[${marker}](${CITATION_HREF_PREFIX}${marker})`)
      .join(" ");
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
