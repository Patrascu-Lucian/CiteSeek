# 040 — `"read"` is the right to ask; `"write"` is the right to leave something behind

**Status**: accepted · **Date**: 2026-08-21 · **Milestone**: 8

## Context

The demo workspace is badged "Read-only demo". It was not read-only.

`accessToWorkspace` returns `"read"` on the demo for every _identified_ actor, guest and
signed-in alike, and `"write"` for nobody. That is the rule the badge describes, and it is
correct. What was wrong is that two write paths authorized `"read"` and then decided for
themselves whether the caller could write, using the wrong question.

Both asked **who is this?** where the question is **may they write here?**

- `createConversation` authorized `"read"`, then special-cased a guest — so a signed-in reader
  passed, and "New conversation" wrote a row into the demo.
- The chat route authorizes `"read"` deliberately, because answering a question _is_ a read and a
  guest must be able to do it. But it then persisted the turn when `actorType === "user"`. And
  `resolveChatForTurn` **creates**: it falls back to `getOrCreateChat`.

The second is the larger half, and it was not in the backlog entry that raised this. The entry
described a button that should not render. Hiding the button would have fixed nothing: a signed-in
visitor asking the demo _any question at all_ created a conversation and stored both messages.

Bounded rather than harmless. `createChatUnless` counts `workspaceId` **and** `userId`, so the cap
is per reader and one person cannot exhaust the demo for everyone. What landed was rows nobody
expected to be writable, and a badge that read as a promise the code did not keep.

## Decision

**Split the rule by verb, not by actor.**

`"read"` is the right to ask. `"write"` is the right to leave something behind. Answering stays a
read, so the guest path is untouched and the demo keeps working for the stranger it exists for.
Every path that stores something authorizes `"write"`, which the demo refuses for everyone.

Three consequences follow, and each removes code rather than adding it.

**`canWrite` is a type guard.** `accessToWorkspace` returns `"write"` only for a signed-in owner,
so a write-authorized actor cannot be a guest. Saying so in the signature — `actor is Extract<Actor,
{ type: "user" }>` — lets `authorizeWorkspace` return a narrowed `AuthorizedWrite`, and lets both
write paths delete their guest branches instead of asserting the same fact locally. `authorize()`
in the chats route lost its second `getActor()` call with it.

**`AuthorizedWorkspace` carries `canWrite`.** A route authorized `"read"` that nonetheless writes —
the chat route, persisting a transcript — needs the write decision without a second resolve. It
must branch on this rather than on `actorType`, which is precisely the mistake being corrected: a
signed-in reader of the demo is a user who may not write.

**The interface follows the boundary.** The Conversations section is gated on `canWrite`, not on
`!isDemo`. The two are equivalent today, and only one of them stays equivalent: `canWrite` is the
decision the server actually makes, so the control disappears for the same reason the request would
be refused. Gating on `!isDemo` would be a second condition free to drift from the first.

Order matters. The boundary first, the interface second — a limit enforced by hiding a button is
not a limit, and that rule is why this was found by reading authorization rather than by a bug
report.

## The comment that defended the defect

`app/api/w/[workspaceId]/chats/[chatId]/route.ts` argued in prose for authorizing `"read"`:

> Authorizing `write` would fail the other way, refusing a signed-in user renaming their own
> conversation in the demo.

True, and circular. The only way to _have_ a conversation in the demo was the gap this ADR closes.
The comment justified a rule by pointing at the behavior the rule produced, and it read as a
considered trade-off for as long as nobody checked which came first.

Worth recording because it is not the usual stale comment. It did not drift from the code; it
described the code exactly, and was wrong about why.

## Consequences

**Rows predating this still exist.** In any database where a signed-in reader used the demo, their
conversations remain. They are no longer listed, reachable or writable — `workspace-view` gates the
whole conversation load on `writable`, so they would otherwise have loaded into a panel with no list
to manage them from, and stopped growing the moment a question no longer persisted. Nothing deletes
them here. Count them before deciding:

```sql
select count(*) from chats c
  join workspaces w on w.id = c.workspace_id
 where w.is_demo and c.user_id is not null;
```

**The guest refusal in the chats route is gone**, not merely unreachable. A guest reaching `"write"`
on any workspace is impossible, so its 403 could never fire — and a 403 there had been mildly at
odds with this file's own rule that not-found and denied answer identically.

**The demo is now the only workspace where read and write differ**, which is what makes it the one
that tests this. `e2e/signed-in.ts` and a borrowed demo fixture cover it: the action 404s, and a
question is answered while `listChats` stays empty.

## What this is not

It is not a permission system. There are still exactly two answers, still derived from ownership
and the demo flag, still in one pure function. Nothing here adds a role, a grant or a column —
[ADR 016](016-workspace-membership-deferred.md) cut those and this does not reopen them.
