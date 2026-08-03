/**
 * The last link in the chain the offsets exist for:
 * `contentText.slice(charStart, charEnd)` should be exactly the passage that was
 * embedded, quoted and cited. "Should be" is doing work there, which is why this
 * checks rather than assumes.
 */

export type CitationHighlight = {
  before: string;
  cited: string;
  after: string;
  /** False means the document changed underneath the citation, so the offsets now
   * point elsewhere. Highlighting the wrong passage confidently is the worst
   * failure this product can have — precise-looking and wrong. */
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
