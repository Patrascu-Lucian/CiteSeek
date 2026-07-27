# 003 — Runtime versions and the version-selection policy

**Status**: accepted · **Date**: 2026-07-27 · **Milestone**: 0

## Context

Version choices were being made one dependency at a time, each defensible in isolation but
with no stated rule behind them. Choosing Postgres 18 exposed the gap: the argument offered
for Postgres 17 was "parity with docker-compose", which was circular — the compose file had
been written an hour earlier and could just as easily say 18.

A stated policy is worth more than a list of pins, because the pins go stale and the policy
does not.

## The policy

**Prefer the newest version that the rest of the stack can actually consume.** Where a
project publishes a long-term-support line, target it. Where none exists — which is most of
this stack — "current stable, minus anything its own ecosystem cannot yet support".

Three practical rules fall out of it:

1. **Check `peerDependencies` before adopting a major.** A package being tagged `latest`
   says nothing about whether its plugin ecosystem can consume it. This has already caught
   two problems (see `001-pin-typescript-5-and-eslint-9.md`).
2. **Never adopt `beta`/`rc` tags for something replaceable.** Where a beta is genuinely
   the only viable option, document why and record the exit path.
3. **Runtime majors track Active LTS, not Current.** Node's own guidance is explicit:
   production applications should run Active or Maintenance LTS, never Current.

## Decisions

### Node 24 "Krypton" — Active LTS

Node 22 "Jod" has moved to maintenance; Node 26 is Current and explicitly not recommended
for production. Node 24 is the Active LTS line and is supported by every dependency that
declares an engine range:

| Package          | Declared `engines.node`              | Node 24 |
| ---------------- | ------------------------------------ | ------- |
| next             | `>=20.9.0`                           | ✅      |
| vitest           | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` | ✅      |
| eslint           | `^20.19.0 \|\| ^22.13.0 \|\| >=24`   | ✅      |
| @playwright/test | `>=20`                               | ✅      |
| typescript       | `>=16.20.0`                          | ✅      |

Note that Vitest's range excludes odd-numbered Current releases entirely — independent
confirmation that tracking LTS is the supported path rather than merely the cautious one.

`engines.node` is `24.x` — a bounded range, not `>=24.0.0`. Vercel flags the open-ended
form during deployment because it silently upgrades the moment a new major ships, which
would drift the runtime onto Node 25 or 26 with no code change and no review. That is
precisely the "Current, not LTS" outcome this policy exists to prevent, and Vitest's engine
range would not even permit it. `.nvmrc` pins `24`, CI runs `node-version: 24`, and
`@types/node` is on the matching `24.x` line so the types describe the runtime actually in
use rather than a newer one.

Moving to the next LTS should be a deliberate edit to this file, not something that happens
because a calendar rolled over.

### PostgreSQL 18

Postgres has no LTS branch as such — every major gets five years of support, so 18 is
supported into 2030. pgvector supports it on both Neon and the `pgvector/pgvector:pg18`
image, so local and production agree.

### Accepted exceptions

Two dependencies knowingly violate "newest stable", both for reasons documented in ADR 001:
`typescript@5.9.3` (typescript-eslint peers `<6.1.0`) and `eslint@9.39.5`
(eslint-plugin-react has no ESLint 10 support).

Two more are stable-but-notable and are accepted rather than fixed:

- **`drizzle-orm@0.45.2` is pre-1.0.** A `1.0.0-rc.4` exists on the `rc` tag. Pre-1.0
  semver offers no breaking-change guarantee between minors, so the version is pinned
  exactly rather than carets. Revisit when 1.0 ships stable.
- **`next-auth@5.0.0-beta.32` is a beta**, and the only remaining beta in the stack. Auth.js
  v4 is the `latest` tag but predates the App Router. See ADR 004.

## Consequences

- Local development requires Node 24; `pnpm install` warns until `nvm install 24` is run.
- GitHub Actions were several majors behind (`checkout@v5`, `upload-artifact@v4`) and were
  brought to current. Actions have no LTS line, and stale majors do eventually get
  deprecated outright — `upload-artifact@v3` was switched off in 2024.
- This policy should be re-run at each milestone boundary, not continuously. Chasing
  versions mid-milestone is how a green build turns red for no product reason.
