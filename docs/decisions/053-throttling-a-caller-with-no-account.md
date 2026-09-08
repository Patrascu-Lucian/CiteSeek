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

**A new `usage_kind`.** `sign_in_link` joins `chat` and `embedding`, and **every** count over
`usage_events` filters on kind — a guest asking the demo questions shares an `ipHash` with a
stranger asking for links, and either would otherwise exhaust the other's allowance.

↳ **Only one direction of that was true when it shipped, and it was the harmless one.** The link
count filtered; the chat counters did not. So five link requests spent five of a guest's eight
questions a minute, and `countAllRequestsSince` — the app-wide ceiling — counted them too, which
made seven addresses at full throttle enough to refuse chat to signed-in users. That ceiling is
denominated in provider calls, and a sign-in link makes none.
`COSTS_A_PROVIDER_CALL` in `lib/usage/queries.ts` is now exhaustive over the enum, so a new kind
does not compile until someone says which side it falls on.

**`actor_type` becomes `"anonymous"`, with the hash as the id.** Both columns are `notNull` and this
caller has no other identity. `UsageActor` is widened for recording only; `lib/auth`'s actor type is
untouched, so nothing downstream can start treating `"anonymous"` as something authorizable.

## Consequences

**The refusal is a thrown error, not a 429.** Auth.js turns it into a failed sign-in, and the reader
is not told which limit they met — naming the threshold would tell a script exactly how to pace
itself. That is a departure from `lib/usage`, whose refusals are structured and rendered, and the
reason is that this caller is as likely to be a script as a person.

**It carries `AccessDenied`, which had to be chosen deliberately.** Auth.js substitutes
`Configuration` for any error it does not recognize, and `/sign-in` words that as "this is a problem
on our side" — false when someone asked for a sixth link, and it hides a real outage among ordinary
throttling. `AccessDenied` is the one client-safe code that fits. `isClientError` tests
`instanceof AuthError`, so the type is set on a subclass rather than matched by string.

**A refused request still writes a verification token.** `send-token.js` starts the adapter write
and the send together and then `Promise.all`s them, so throwing from `sendVerificationRequest`
stops the mail and not the row. Refusing earlier would mean a check outside the provider, which is
the thing this decision rejected — so the row is accepted and `pruneVerificationTokens` collects it
once it expires, fifteen minutes later.

**That sweep runs below the admission check, not above it.** Above, an anonymous caller paces it: the
gate is process-global rather than per-caller, and `atMostEvery` claims its window only once the work
resolves, so a failing sweep would be retried by every request. Below, arrival is bounded by the
allowance, and the failure is swallowed _inside_ the work — `swallowFailures` in `lib/sweeps.ts` —
so the window is claimed either way. Refused callers therefore sweep nothing, which costs nothing:
the rows they leave are collected by the next caller who is admitted, anywhere.

**And it has a second host**, the `GET` on `/api/w/:id/documents`, sharing one gate. The sign-in path
alone strands the last rows: whoever asks for the final link leaves one that expires with no later
request to collect it. That host is bounded by authorization rather than by an allowance — it is a
signed-in workspace read — so "the allowance paces the sweep" is true of the sign-in path only, and
the swallow is what the two have in common. Neither host bounds the tail on a deployment that has
gone entirely quiet, which is why the privacy page says rows are cleared as later requests arrive
rather than naming a schedule.

**Rotating `AUTH_SECRET` resets every allowance**, because the hash changes. The same trade guest
cookies already make, recorded in the `usage_events` schema comment.

**What this does not cover**: a caller with many addresses. Nothing here is a defence against a
botnet, and it is not meant to be — it bounds a single caller and keeps the bill finite.
