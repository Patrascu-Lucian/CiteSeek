# 013 — Chat persistence for signed-in users only

**Status**: accepted · **Date**: 2026-07-29 · **Milestone**: 2

## Context

The `chats` and `messages` tables have existed since Milestone 0, and `messages.citations`
was designed from the start to hold the anchors a rendered answer needs. Milestone 2 is the
first milestone with conversations to put in them.

Two callers reach the chat route. A signed-in user, and a guest — an anonymous visitor
holding a signed cookie, reading the shared demo workspace. The route authorizes `read` for
both, because asking a question retrieves; it does not modify a document.

Persisting a conversation, however, _is_ a write.

## Decision

**Signed-in conversations are stored. Guest conversations live in browser state and are gone
on reload.**

### Why not persist guest chats

The schema permits it — `chats.userId` is nullable precisely so a guest chat could exist. The
objection is not schema, it is exposure.

A guest needs no account, no email, and no approval. The demo is a public URL whose entire
purpose is that a stranger can click it. Writing rows for that caller puts an **unbounded
write path behind an unauthenticated URL**: every visit creates a chat, every question two
messages, and nothing limits how many visits there are. That is the amplification ADR 005
avoided when it made the demo workspace read-only, and chat would quietly reintroduce it
through a different table.

The cost is real and visible: a guest who reloads loses their conversation. That is the
honest consequence of not having an account, and the demo's job — letting someone try the
product in one sitting — survives it.

Rate limiting (Milestone 3) would make guest persistence defensible later. Building the write
path first and the limit afterwards is the wrong order.

### Why persist at all now, rather than deferring to Milestone 4

Milestone 4 owns conversation _management_ — history, rename, delete. That is UI over data
that has to already exist. Deferring storage entirely would mean a signed-in user losing
their conversation on every refresh through two milestones, and Milestone 4 building
persistence from scratch instead of building on it.

### What gets stored, and in what order

The **full numbered source list** is stored on the assistant message, not only the passages
the model happened to cite. Markers are positional — `[n]` resolves to `citations[n - 1]` —
so storing a subset would renumber the list on reload and silently repoint every marker in
the text. A citation that quietly changes what it points at is worse than one that fails.

Refusals are persisted too, with an empty citation list. A transcript that dropped the "I
couldn't find anything relevant" turns would misrepresent the conversation.

Message order comes from an explicit `position` column rather than `created_at`. Both rows of
a turn are written by one statement and `now()` is the transaction timestamp, so they share
it exactly — see `docs/code-review-notes.md`.

The filename moved onto `MessageCitation` as part of the same decision. It is a snapshot, not
a join: a chip must name its source after the document is deleted, and reading the name live
would let a rename rewrite what an old answer appears to have cited.

## Consequences

- **Two behaviors to explain in the UI.** A guest is told their conversation is not saved
  rather than left to discover it by reloading.
- **Milestone 4 inherits data, not a migration.** History and rename are queries over rows
  that already exist.
- **Guest persistence stays available.** Nothing here forecloses it; it needs the rate
  limiting Milestone 3 brings, at which point `userId` being nullable is the only schema
  change required — which is to say, none.
- **Deletion still has to be real.** Chats cascade from workspaces and users, and the
  account-deletion test now covers messages too.
