/**
 * Apart from `queries.ts` deliberately: the rename form is a client component,
 * and importing a *value* from there pulls in `lib/db` → `postgres`, failing the
 * build with `Can't resolve 'fs'`. The error names `node_modules/postgres`; the
 * cause is one identifier in a form component. A `type` import is erased.
 */

/** Chat titles are derived from the first question; longer ones are cut here. */
export const MAX_TITLE_LENGTH = 80;

export function titleFromQuestion(question: string): string {
  const collapsed = question.replace(/\s+/g, " ").trim();

  return collapsed.length <= MAX_TITLE_LENGTH
    ? collapsed
    : `${collapsed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
