# 005 — Guest sessions live outside Auth.js

**Status**: accepted · **Date**: 2026-07-27 · **Milestone**: 0 (Slice 3)

## Context

Guest/demo mode is a product requirement, not a convenience: an interviewer with the URL
must be able to use CiteSeek without signing up, and Milestone 5's exit criterion is that a
stranger understands it cold. That means an unauthenticated visitor needs _some_ session.

Auth.js is already in the project for GitHub OAuth. The obvious move is to make guests
Auth.js users too, via a Credentials provider that mints an anonymous account.

## Options considered

1. **Anonymous users through Auth.js Credentials** — one session mechanism for everyone.
2. **A separate signed cookie for guests**, with Auth.js owning real accounts only.
3. **No guest session; make the demo world-readable** — no credential at all.

## Decision

Option 2. `lib/auth/guest.ts` issues an HMAC-SHA256 signed token; `lib/auth/actor.ts`
resolves either mechanism into one `Actor` union that the rest of the app consumes.

Option 1 was rejected on three counts. It writes a `users` row for every visitor who
clicks "Try the demo", so a public demo link becomes an unbounded write amplifier for
anyone who wants one. Every ownership check then has to ask "is this a _real_ user?",
which is the special-casing the abstraction was supposed to remove. And Auth.js's
Credentials provider requires the JWT session strategy, which would have forced the whole
app off database sessions to accommodate the one case that needs no persistence at all.

Option 3 is simpler but gives up per-guest rate limiting, and Milestone 3 needs to throttle
the demo against abuse — a free-tier API key behind a public URL. Throttling requires an
identity to throttle.

## Consequences

- **Guests are never persisted.** Entering the demo costs zero writes: the token is
  self-contained and verified by signature, so an unauthenticated visitor cannot make us
  insert anything.
- **The signature has to be load-bearing, and that shaped the authorization rule.** The
  first draft made the demo workspace readable by anyone including `null`, which meant a
  forged cookie granted exactly what an absent one did — the crypto protected nothing.
  `accessToWorkspace` now denies anonymous requests outright, so an invalid or expired
  token resolves to `null` and is refused.
- **Two session mechanisms exist, but only `getActor()` knows that.** Route handlers and
  Server Components depend on the `Actor` union. This is the same seam ADR 004 relies on
  for its exit path from Auth.js.
- Comparison is constant-time (`timingSafeEqual`); a `===` on a signature leaks how many
  leading bytes an attacker guessed.
- Tokens expire after 24 hours. A demo visit is minutes, and a short window limits the
  value of a leaked cookie.
- **Middleware is not the authorization boundary.** It only checks cookie _presence_,
  because it runs on the Edge runtime where `node:crypto` is unavailable. The real check —
  signature verification plus `accessToWorkspace` — happens in the page. Treating
  middleware as the boundary is a common and load-bearing mistake, so it is called out in
  a comment there.
