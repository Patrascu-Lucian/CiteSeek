/**
 * Cookie names, deliberately kept in a module with no Node built-in imports.
 *
 * `proxy.ts` runs on the Edge runtime, where `node:crypto` does not exist.
 * Importing these constants from `guest.ts` — which needs crypto to sign and
 * verify — pulls the whole module into the Edge bundle and fails at request time
 * with "Native module not found: node:crypto", surfacing as a 500 on every
 * protected route. Splitting the constants out keeps that import graph clean.
 */

export const GUEST_COOKIE_NAME = "citeseek.guest";

/** Set by Auth.js; the `__Secure-` prefix is used when serving over HTTPS. */
export const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

/** Auth.js's default, named because two pages quote it. Counted from signing
 * in: the session row slides forward on use, but `auth()` in a server component
 * drops the refreshed cookie, so the browser's copy keeps its first date. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
