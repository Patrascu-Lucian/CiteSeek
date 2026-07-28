/**
 * The one canonical text transform.
 *
 * Every character offset stored in `chunks` refers to the output of this
 * function. That makes it load-bearing in a way that is easy to miss: normalize
 * twice, or normalize after chunking, and every offset silently points a few
 * characters off. Citations would still render — just the wrong text, with no
 * error anywhere. So this runs exactly once, immediately after extraction and
 * before anything measures a position.
 *
 * Kept deliberately conservative. It is tempting to collapse runs of spaces or
 * trim every line, but each transformation that removes characters is one more
 * chance for an offset to drift from what a reader sees, and PDF extraction
 * already produces enough irregular whitespace to make aggressive cleanup risky.
 */

/** Separator between page texts when joining a PDF into one document. */
export const PAGE_SEPARATOR = "\n\n";

export function normalizeText(input: string): string {
  return (
    input
      // Windows and classic-Mac line endings become LF, so a line break is one
      // character everywhere. Without this the same document chunked on
      // different platforms would produce different offsets.
      .replace(/\r\n?/g, "\n")
      // NUL bytes appear in damaged PDFs and Postgres rejects them outright in
      // text columns -- an ingest would fail at the last step, after all the
      // embedding work was already paid for.
      .replace(/\0/g, "")
      // Form feeds are page markers in some extractors. Page boundaries are
      // tracked explicitly via pageSpans, so these carry no information and
      // would only show up as stray glyphs in a citation.
      .replace(/\f/g, "\n")
      // Non-breaking and other exotic spaces render as spaces but break word
      // splitting in the chunker. Written as escapes rather than literal bytes so
      // the diff shows which codepoints are covered:
      //   U+00A0 no-break space, U+2007 figure space, U+202F narrow no-break
      .replace(/[\u00a0\u2007\u202f]/g, " ")
      // Three or more blank lines collapse to one blank line. PDF extraction
      // routinely emits long vertical gaps; left alone they push chunk budgets
      // toward whitespace instead of text.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Join per-page text into one document while recording where each page starts
 * and ends.
 *
 * Pages are normalized individually and then joined, rather than joined and then
 * normalized, so that the spans returned here are guaranteed to be positions in
 * the string this function returns. Normalizing afterwards could shift every
 * boundary.
 */
export function joinPages(pages: readonly string[]): {
  text: string;
  pageSpans: PageSpan[];
} {
  const spans: PageSpan[] = [];
  const parts: string[] = [];
  let offset = 0;

  pages.forEach((page, index) => {
    const normalized = normalizeText(page);

    if (index > 0) offset += PAGE_SEPARATOR.length;

    spans.push({
      pageNumber: index + 1,
      charStart: offset,
      charEnd: offset + normalized.length,
    });

    parts.push(normalized);
    offset += normalized.length;
  });

  return { text: parts.join(PAGE_SEPARATOR), pageSpans: spans };
}

export type PageSpan = {
  /** 1-based, as a reader would say it. */
  pageNumber: number;
  charStart: number;
  /** Exclusive. */
  charEnd: number;
};

/**
 * Which page a character offset falls on.
 *
 * Returns null when the document has no page concept (docx, markdown, plain
 * text) so callers store null rather than inventing "page 1" for a format that
 * has no pages — a citation claiming a page number that cannot be verified is
 * worse than one that admits it has none.
 *
 * An offset landing in the separator between two pages is attributed to the page
 * that just ended, which is where the surrounding text actually came from.
 */
export function pageNumberForOffset(
  offset: number,
  pageSpans: readonly PageSpan[] | null,
): number | null {
  if (!pageSpans || pageSpans.length === 0) return null;

  let candidate: number | null = null;

  for (const span of pageSpans) {
    if (offset < span.charStart) break;
    candidate = span.pageNumber;
    if (offset < span.charEnd) return span.pageNumber;
  }

  // Past the end of the last page, or inside a trailing separator: attribute to
  // the last page that started at or before the offset.
  return candidate ?? pageSpans[0]!.pageNumber;
}
