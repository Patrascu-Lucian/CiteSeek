# 016 — Workspace membership and multiple workspaces, deferred

**Status**: accepted · **Date**: 2026-07-31 · **Milestone**: 4

## Context

Milestone 4 was planned as "the product surface": conversation history, a usage dashboard, an
account page, and **workspace roles — owner / member / viewer — enforced in route handlers and
query helpers rather than by hiding buttons**, alongside management of multiple workspaces per
user.

Roles are the item with the most obvious interview appeal in the milestone, which is exactly why
it deserves an explicit decision rather than a quiet omission.

## Decision

**Neither workspace membership nor multiple workspaces per user is built now.** Everything else
in the milestone ships.

### Why roles are not built

**The claim they would buy is already true, and already tested.** Authorization is a single pure
function over plain data — `accessToWorkspace(actor, workspace)` in `lib/auth/authorization.ts`
— and every helper that reads workspace-owned data takes a workspace scope and filters on it in
SQL. Seven integration tests in `lib/documents/queries.integration.test.ts` prove another
workspace's documents cannot be listed, found, updated, deleted, or have chunks read or written,
and they run in CI against a real database. "Authorization is enforced in the data layer, not by
hiding buttons" is a statement this codebase can already make and demonstrate.

**A role enum would add a dimension nothing can exercise.** The honest minimum is a
`workspace_members` table and a membership lookup folded into the workspace read. But there is
no way to create a second member: invitations need email, and email sign-in is itself deferred
for want of a configured sender (see the backlog). Every workspace in production would have
exactly one row, with the role `owner`, forever. A test that a `viewer` cannot write would be a
test of a code path no user can reach — and an untested-in-reality authorization branch is worse
than an absent one, because it looks like a guarantee.

**The expensive decision was already made, in Milestone 1.** Retrofitting isolation into a
codebase that assumed a single tenant means auditing every query ever written. That is the
one-way door, and it was closed correctly: `workspace_id` is on every owned row and no unscoped
query helper exists. Adding membership later is an additive migration plus a change to one pure
function. ADR 007's rule is **protect optionality, do not pursue it**; this is what that looks
like when applied to the most tempting item in a milestone.

### The seam, for when membership does arrive

Recorded now so the shape is not re-derived later. `accessToWorkspace` is synchronous and pure,
which is what makes it cheap to test exhaustively. Membership must not change that:

- `findWorkspaceById` (`lib/auth/demo.ts`) grows to return the caller's membership row alongside
  the workspace, so the database round trip stays where round trips already happen.
- `WorkspaceAccessSubject` gains the caller's role, and `accessToWorkspace` gains a branch. It
  stays pure and synchronous.
- The `Access` type already distinguishes `"none" | "read" | "write"`, which is the vocabulary a
  viewer/member/owner split needs. No caller has to change to accommodate it.

### Why multiple workspaces are not built

It needs a switcher, a create flow and a delete flow, and it multiplies the surface of every
other Milestone 4 item: history, documents and the usage dashboard would each need to answer
"which workspace?" The stated need is weak — one user, one personal workspace, plus the shared
demo — and the cost lands on four features rather than one.

A stale comment in `lib/workspaces/personal.ts` promised this milestone would add it, and
justified the absence of a unique constraint on that basis. The comment is corrected in the same
change as this ADR. That is the second time a comment naming a future milestone has become
wrong when scope moved (`lib/auth/guest.ts` was the first, in Milestone 3) — **a comment that
promises a milestone is a lie with a delayed fuse**, and the constraint decision it explains has
to stand on its own reasoning instead.

## Consequences

- **The milestone fits.** Cutting these two is what makes the remaining scope — account page,
  navigation, conversation history, usage dashboard, the refusal that helps, a PDF demo fixture,
  dark mode, privacy policy — deliverable without borrowing from the quality bars.
- **The demo workspace stays the only shared one.** It is `ownerId: null, isDemo: true`, and
  read-only for everyone including signed-in users. Nothing here changes that.
- **No migration is needed to change course.** Both items are additive, which is the property
  that makes deferring them safe rather than merely convenient.
- **Sharing a workspace with another person is not possible**, and will not be until membership
  lands. For a product with one user that is a description of the present rather than a
  limitation of it, but it should not be described as anything else.
