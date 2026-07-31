/**
 * Naming a conversation. No database, and deliberately so.
 *
 * These live apart from `queries.ts` because the rename form needs the limit and
 * that form is a client component. Importing a *value* from `queries.ts` pulls
 * the module in, which imports `lib/db`, which imports `postgres` — and the
 * build fails with `Can't resolve 'fs'` from a file that never mentions a
 * database. A `type` import is erased and would have been harmless; a constant
 * is not.
 *
 * Worth stating because the failure names the wrong thing: the error points at
 * `node_modules/postgres`, and the cause is one identifier in a form component.
 */

/** Chat titles are derived from the first question; longer ones are cut here. */
export const MAX_TITLE_LENGTH = 80;

export function titleFromQuestion(question: string): string {
  const collapsed = question.replace(/\s+/g, " ").trim();

  return collapsed.length <= MAX_TITLE_LENGTH
    ? collapsed
    : `${collapsed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
