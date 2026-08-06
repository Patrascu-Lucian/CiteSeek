# 014 — Usage limiting: threat model and mechanism

> **Amended by [ADR 025](025-paying-for-the-model-tier.md), 6 August 2026.** The threat model
> below says the consequence of exhaustion "is not a bill", which was true on the free tier. The
> deployment is on the paid tier now, and the sentence survives for a reason worth knowing:
> credits are prepaid with auto-reload off, so an exhausted balance returns the same `429` as an
> exhausted quota and lands in the same refusal. Nothing here changes — the ceiling is money, and
> it is bounded by the balance rather than by Google's quota.

**Status**: accepted · **Date**: 2026-07-30 · **Milestone**: 3

## Context

The product is live and nothing limits it. `/demo` is a public URL that needs no account, and
every question asked through it spends from one shared Google Cloud project quota — shared, in
fact, across chat, embeddings, the development key and the production key alike, because
Gemini's limits are per project rather than per key.

So a single bot, or one bored visitor with a loop, can exhaust the day's allowance. The
consequence is not a bill; on the free tier it is that **the demo stops answering** — for
everyone, until the quota resets. A public demo that is silent when someone opens it is the
failure this project most needs to avoid, and it is caused by traffic nobody legitimate sent.

## The threat model

Worth stating plainly, because it determines what a good answer looks like.

**What is being defended:** a finite daily quota, and the availability that depends on it.

**What is not:** data. Tenant isolation already prevents one workspace reading another (ADR
007, enforced in SQL and proven by integration tests). Nothing here is a confidentiality
control, and it should not be mistaken for one.

**Who the adversary is:** an anonymous visitor with a script. Not a sophisticated attacker —
someone curious, or automated, who can trivially discard a cookie and retry. There is no
authentication to bypass because the demo deliberately has none.

**What "success" looks like for them:** enough requests to exhaust the quota. That is the only
lever they have, and it is cheap to pull.

## Decision

### One Postgres table, not a vendor

`usage_events` is append-only and answers all three questions with indexed range scans:
requests in the last minute (the rate limit), tokens today for one caller (the personal cap),
tokens today across everyone (the global cap).

The alternatives were considered and rejected on specifics rather than taste:

- **Vercel WAF rate limiting** is free on Hobby and blocks at the edge before a function runs,
  which is genuinely better protection. It also cannot express this policy on that plan: **one
  rule per project, a ten-minute maximum window, and IP-only counting keys.** A _daily_ cap is
  not representable. It remains the documented upgrade if abuse becomes real.
- **Upstash Redis** is purpose-built for exactly this and would do the rate limiting well. It
  adds a vendor, a secret CI would need, and a second store to reason about — and the daily
  token cap would still need Postgres, so it solves one of the two problems.

The database is already there, colocated with the functions in `fra1`, and — decisively — a
Postgres counter can be exercised by tests. The 429 and "capacity reached" states get real
coverage locally, in CI and in E2E. Nothing platform-level can be tested that way, and an
untested limiter is one nobody knows is working.

It also becomes Milestone 4's usage dashboard without a migration.

### Guests are keyed on address, not identity

`/demo` mints a fresh signed cookie on every visit. A guest's id is therefore **self-assigned**:
clearing a cookie produces a new identity, and a script gets one per request for free. Keying a
limit on it would be theater.

Guests are counted by client IP, which the visitor does not control. Signed-in users are counted
by their user id, which they cannot mint more of.

Header order is `x-vercel-forwarded-for`, then `x-real-ip`, then the first entry of
`x-forwarded-for`. That order matters: **`x-forwarded-for` is client-supplied**, so anyone can
send one and claim another address. It is read last, and only its leftmost value, because a
forwarded chain reads from the original client outward and appending to it is how a caller
would try to hide. Off-platform there is a fixed `"local"` sentinel rather than nothing — an
unkeyed request would be exempt from every limit, and a limiter that silently stops applying
outside production is one nobody notices is broken.

### Addresses are stored hashed

`HMAC-SHA256(ip, AUTH_SECRET)`, using the primitive that already signs guest cookies. Equality
on the hash counts identically to equality on the address, so enforcement is unchanged and the
table never holds an address in the clear.

The function **throws when no secret is configured** rather than falling back to storing the
address. A missing secret is a misconfiguration, and quietly degrading to plaintext personal
data is not a degradation anyone would choose. This is not free — it made the integration suite
fail on CI, which had no secret — but the noisy failure is the feature: the silent version
would have shipped and recorded raw IPs while every test stayed green.

Rotating `AUTH_SECRET` re-keys every hash and therefore resets every limit. Acceptable, and the
same trade already made for guest cookies, which all stop verifying on rotation.

Rows are pruned after **30 days** — comfortably longer than any window a cap looks back over,
long enough for the usage dashboard, and short enough that a hashed address is not retained to
answer a question nobody asks. The sweep runs from the documents list, the same way
`failStaleProcessing()` does, because this project has no scheduler and adding one to run a
`DELETE` would be a great deal of infrastructure for one statement.

### Guests stop first; signed-in users keep a reserved share

The demo is the exposed surface. Reserving headroom below the global cap means a bot hammering
it cannot take down the owner's own workspace — which matters precisely in the scenario the
demo exists for: someone evaluating the product while its author is also using it.

### Requests are enforced; tokens are recorded

The free tier's binding constraint is requests per day, not tokens — the ingestion numbers
already showed request-rate is what bites first. Tokens are the cost unit the moment there is a
paid tier, and the dashboard needs them, so both are recorded and requests are what the limit
counts.

### Refusals are metered

A query is embedded **before** the relevance floor is applied, so a question matching nothing
has still been paid for. Metering only answered questions would leave the cheapest way to spend
someone's quota — asking nonsense on a loop — entirely uncounted. This is why the embedder seam
carries token counts at all.

### The provider's own 429 is the same condition

Because limits are per project, our caps can be correctly configured and Gemini can still
return `429 RESOURCE_EXHAUSTED`. The "capacity reached" state must be reachable from upstream
too, or the first real exhaustion arrives as an unhandled error. Note the mechanics differ: our
cap is a pre-flight JSON 429, the upstream one arrives mid-stream and needs an error part the
client can classify.

### The limit is soft, deliberately

Checking and then acting is not atomic, so two concurrent requests can both pass a threshold.
Preventing that would mean serializing every request through a transaction to avoid an
overshoot of one or two. This defends a quota, not a billing boundary, and the overshoot is
smaller than the noise in the quota itself.

### Not in middleware

`proxy.ts` runs on Edge and the Postgres client is Node-only — the same constraint that caused
the Milestone 0 production outage. Enforcement lives in the route handlers, which already
declare `runtime = "nodejs"`.

## Consequences

- **A function invocation is still spent** on a request that gets refused. Postgres cannot
  block at the edge; only the WAF can, which is what makes it the upgrade path rather than a
  rejected option.
- **Recording failure degrades the caps silently.** If inserts stop succeeding, usage stops
  counting and every limit quietly stops applying. `recordUsage` returns whether it recorded so
  a caller can react; that signal exists and is not yet consumed.
- **Shared addresses share a bucket.** Office NATs, mobile carriers and university networks all
  present one address for many people. Guest limits must be generous enough that a coincidence
  of visitors is not mistaken for abuse — which is an argument for tuning against real traffic
  rather than reasoning about it.
- **Thresholds are provisional**, in the same sense the relevance floor is, and for the same
  reason: they need traffic to calibrate against. They live behind an env-resolved config so
  CI can tighten them for a test and production is not edited to run one.
