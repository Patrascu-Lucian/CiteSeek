# 053 — Throttling a caller with no account

## Context

Magic-link sign-in adds the first endpoint in this app where **an anonymous caller can cause an
outbound email, to an address they choose, as often as they ask**. Every other cost in the system
sits behind a session: the chat route needs an authorized workspace, ingestion needs a document,
and both are counted against an actor.

A sign-in link has none of that. There is no account yet — that is the point of it.

The existing throttle is real and shipped: `decideUsage` compares `requestsInLastMinute` against a
burst cap and `enforceUsageLimits` turns a refusal into a 429 carrying `Retry-After`. It is a flow
limit over `usage_events`, which is what that table was built for. What it cannot do is count
somebody who has no actor and no workspace, because that is the shape of its arguments.

## Decision

**Reuse `usage_events`, count on the IP hash, and throttle inside `sendVerificationRequest`.**

**Not a second table.** One would duplicate the retention window, the pruning job and the IP
hashing that already exist, and split "how much has this caller spent" across two places.

**Not `enforceUsageLimits`.** That function takes an `AuthorizedWorkspace` and returns a
`NextResponse`, neither of which this caller has: it is inside a provider callback, not a route
handler. `lib/usage/sign-in-links.ts` reuses the table and the counting query and shares nothing
else.

**In the provider, not in a route.** Auth.js owns `/api/auth/*`, so there is no route file to put a
check in — and the send is the line that costs money. A limit anywhere else has another way in.

**Keyed on the caller, never on the address.** Counting per recipient would let anyone lock a chosen
person out of their own account by spending their allowance for them. The `ipHash` is
`HMAC-SHA256(ip, AUTH_SECRET)`, which the table already stores and never reverses.

**Recorded before the send.** A provider that is slow or failing must not become a way to exceed
the allowance.

## Why this is not the contradiction it looks like

ROADMAP 7.5 carries a standing instruction: _do not extend `enforceUsageLimits` to carry both._
That was written about **stock** limits — documents, conversations, saved messages — which never
heal and whose refusal has to name what to delete. Mixing those into a flow limit would produce one
function returning two refusals whose remedies contradict each other.

This is a **flow** limit. It counts events in a rolling window and heals as the window slides, which
is exactly what `usage_events` is for. The instruction governs the shape of the refusal, not the
storage — and the decision above keeps them in separate modules anyway.

## The cost, stated

**Five links an hour per caller** ([`SIGN_IN_LINKS_PER_HOUR`](../../lib/usage/sign-in-links.ts)). A
reader needs one, and two more if the first went to spam. A script needs thousands.

**Shared egress is who this is unfair to.** An office or a mobile carrier behind one address shares
an allowance, so a colleague signing in can spend somebody else's. The alternative — counting per
recipient — trades that for letting an attacker deny sign-in to a named person, which is worse:
one is a stranger inconvenienced, the other is a targeted lockout.

**A new `usage_kind`.** `sign_in_link` joins `chat` and `embedding`, and the count filters on it —
without that, a guest asking the demo questions shares an `ipHash` with a stranger asking for links,
and either would exhaust the other's allowance. An integration test pins this specific case.

**`actor_type` becomes `"anonymous"`, with the hash as the id.** Both columns are `notNull` and this
caller has no other identity. `UsageActor` is widened for recording only; `lib/auth`'s actor type is
untouched, so nothing downstream can start treating `"anonymous"` as something authorizable.

## Consequences

**The refusal is a thrown error, not a 429.** Auth.js turns it into a failed sign-in, and the reader
is not told which limit they met — naming the threshold would tell a script exactly how to pace
itself. That is a departure from `lib/usage`, whose refusals are structured and rendered, and the
reason is that this caller is as likely to be a script as a person.

**Rotating `AUTH_SECRET` resets every allowance**, because the hash changes. The same trade guest
cookies already make, recorded in the `usage_events` schema comment.

**What this does not cover**: a caller with many addresses. Nothing here is a defence against a
botnet, and it is not meant to be — it bounds a single caller and keeps the bill finite.
