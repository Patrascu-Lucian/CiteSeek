/**
 * The one canonical text transform. Every offset in `chunks` indexes its output,
 * so normalizing twice — or after chunking — silently shifts every citation to
 * the wrong text with no error anywhere. Runs exactly once, after extraction and
 * before anything measures a position.
 *
 * Conservative on purpose: every character removed is another chance for an
 * offset to drift from what the reader sees.
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
      // Exotic spaces render as spaces but break word splitting in the chunker.
      // Escapes rather than literal bytes so the diff shows the codepoints:
      //   U+00A0 no-break, U+2007 figure, U+202F narrow no-break
      .replace(/[\u00a0\u2007\u202f]/g, " ")
      // Three or more blank lines collapse to one blank line. PDF extraction
      // routinely emits long vertical gaps; left alone they push chunk budgets
      // toward whitespace instead of text.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Normalize each page then join, not the reverse: the spans returned must be
 * positions in the string returned, and normalizing after would shift them. */
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
 * Null for formats with no pages, rather than inventing "page 1" — a citation
 * claiming an unverifiable page is worse than one admitting it has none. An
 * offset inside a page separator belongs to the page that just ended.
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
