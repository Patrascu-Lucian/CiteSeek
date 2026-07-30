# 015 — Failing the build on schema drift

**Status**: accepted · **Date**: 2026-07-30 · **Milestone**: 3

## Context

Nothing connected "a migration exists in the repo" to "the database has it". Vercel deploys on
push; migrations are applied by hand. The two are independent, and the gap between them has
already cost one production incident and several confusing minutes.

Migration 0001 added `content_text` and `page_spans`. It was applied to the development branch
and shipped without being applied to production. Uploads then returned 500s with no body while the
documents list kept working — because the list selects columns explicitly and the insert used a
bare `.returning()`, which asks for every column the schema declares. The symptom pointed
nowhere near the cause.

Milestone 3 makes the gap worse rather than better. Migration 0003 adds `usage_events`, and the
next slice enforces rate limits and quota caps by querying it. A missing table there does not
degrade a feature — it means **the limits silently do not apply**, which is the failure mode a
safety mechanism must never have.

## Decision

**A build-time check that fails the deploy. It checks; it does not migrate.**

`pnpm db:check` compares the migration journal against Drizzle's `__drizzle_migrations` table
and exits non-zero when the database is behind, naming the migrations that are missing. Vercel
runs it ahead of the build:

```json
{ "buildCommand": "pnpm db:check && pnpm build" }
```

A drifted database therefore fails the deploy, and the previously deployed version keeps
serving.

### Why not run migrations in the build

This was the obvious alternative and it is the one that can do real damage. A build step that
migrates is a build step that **mutates a database**, and a _preview_ build would mutate
whichever database the Preview environment points at. Getting that environment mapping wrong
once — or changing it later and forgetting — turns a preview deployment into an unplanned
production migration. The blast radius is unbounded and the mistake is invisible until it has
happened.

There is a subtler objection too: automatic migration removes the moment where someone decides
a migration is safe to run. Additive changes are fine; a destructive one wants a human who has
thought about whether the currently-deployed code still needs the thing being dropped.

### Why not fail fast at startup

The other candidate the backlog recorded. It detects drift honestly, and it takes the entire
application down when it fires — every route, including the demo. For a portfolio whose central
artifact is a working live URL, converting "one endpoint is broken" into "the site is down" is
the wrong trade.

Failing the build inverts that: nothing new ships, and what is already running stays running.

### What it costs

The order becomes explicit — migrate, then deploy — which is already the habit. The check adds
one query to each build and cannot change anything. A database that is _ahead_ of the repo
passes, which is correct: that is what a rollback looks like, and additive migrations are
compatible with older code by design.

## Consequences

- **Deploys can now fail for a reason unrelated to the code.** That is the point, and the
  message names the missing migrations rather than leaving someone to count.
- **It does not catch every drift.** A migration edited after being applied, or a schema
  changed by hand, both pass — the check counts applied migrations rather than verifying the
  shape of the schema. It closes the failure that actually happened, not every conceivable one.
- **CI is unaffected**, because CI runs `pnpm build` directly and only Vercel uses
  `buildCommand`. CI's placeholder `DATABASE_URL` is deliberately non-connectable, and a check
  running there would fail for the wrong reason.
- **Expand-and-contract still matters.** Because deploys and migrations remain separate steps,
  a migration is briefly live against the previous version of the code. Additive changes are
  safe; dropping a column still requires two releases, and nothing here enforces that.
