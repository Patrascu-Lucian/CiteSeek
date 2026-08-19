/**
 * Postgres rejects a non-uuid with `22P02`, which throws out of the query rather
 * than returning no rows — so a lookup handed a client id refuses it here, or its
 * "not found" path is unreachable for the ids most likely to be wrong.
 */
const CANONICAL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return CANONICAL.test(value);
}
