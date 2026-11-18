# 063 — A Preview database is never a copy of production

**Status**: accepted, 13 November 2026.

## Context

The Neon integration gave each Preview that Vercel built a database branch of its own, made from
the project's default branch, which is production. So every such Preview ran on a full copy of
production: readers' documents, passages, accounts and conversations. The copy lived as long as its
branch did, and an account deleted in production lived on in it until then, an exception to the
deletion the privacy page promises. The branches also counted against the project's limit of ten.

It surfaced in the 1.13.0 smoke test. The smoke branch's database was at production's schema, one
migration behind the release, so its build failed `db:check`. That copy was deleted with the branch.

## Options

- **Keep the integration as it was.** Previews see production-shaped data, which no fixture
  reproduces. Rejected: a copy of every reader per branch is not worth the shape, and the branches
  fill the limit.
- **Keep the integration, with `preview/develop` as the default branch it copies.** No reader's data
  is copied, but every branch Vercel builds still takes one of the ten.
- **No integration, and one Preview database.** Chosen.

## Decision

The integration is removed. Every Preview uses `preview/develop`, through Vercel's Preview database
variables. It and `dev`, the local database, both began as branches of production, and both were
checked when this was decided: each holds only the author's own test accounts. A copy of production
is made by hand, for a named purpose, and deleted when that purpose is served.

## Consequences

- **A reader's data exists only in production**, so deleting an account leaves no other branch
  holding it.
- **A branch's parent is history, not a setting.** `preview/develop` still names production as its
  parent, and Neon cannot change that. Its **Reset from parent** would copy production into it
  again, so it is never used.
- **Every Preview shares `preview/develop`**, a throwaway branch's included. A smoke test that
  configures the fake embedder there does not upload, or its fake vectors land where `develop`'s
  Preview reads.
- **A branch carrying an unmerged migration cannot use the shared database without migrating
  `develop`'s**, so a migration is rehearsed on a deliberate branch first, as 0011's was.
