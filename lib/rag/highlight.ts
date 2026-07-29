/**
 * Locating a cited passage inside its source document.
 *
 * This is the last link in the chain the offsets exist for. Chunking recorded
 * `charStart`/`charEnd` against the canonical text (ADR 008), ingestion stored
 * that same text as `documents.contentText`, and retrieval carried the offsets
 * through to the citation. Here they are finally used:
 * `contentText.slice(charStart, charEnd)` should be exactly the passage that was
 * embedded, quoted and cited.
 *
 * "Should be" is doing work in that sentence, which is why this function checks
 * rather than assumes.
 */

export type CitationHighlight = {
  before: string;
  cited: string;
  after: string;
  /**
   * Whether the sliced text still matches the quote captured at answer time.
   *
   * False means the document changed underneath the citation — re-uploaded,
   * re-extracted by a different parser version — so the offsets now point
   * somewhere else. Highlighting the wrong passage confidently is the single
   * worst failure this product can have: the citation looks precise and is
   * wrong. Better to detect it and say so.
   */
  matchesQuote: boolean;
};

export function highlightForCitation(
  text: string,
  citation: { charStart: number; charEnd: number; quote: string },
): CitationHighlight {
  // Offsets are UTF-16 code units, matching JavaScript string indexing and
  // Postgres `text` — the same units chunking measured in.
  const start = Math.max(0, Math.min(citation.charStart, text.length));
  const end = Math.max(start, Math.min(citation.charEnd, text.length));

  const cited = text.slice(start, end);

  return {
    before: text.slice(0, start),
    cited,
    after: text.slice(end),
    matchesQuote: cited === citation.quote,
  };
}
