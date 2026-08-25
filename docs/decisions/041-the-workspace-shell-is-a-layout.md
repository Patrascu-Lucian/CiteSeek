# 041 — The workspace shell is a layout, and what that did not buy

**Status**: accepted · **Date**: 2026-08-21 · **Milestone**: 8

## Context

`/w/[workspaceId]` and `/w/[workspaceId]/c/[chatId]` were sibling segments with no layout
between them, and each rendered the whole workspace independently. So switching conversations
unmounted one page and mounted the other, taking `main`, the document list and the conversation
list with it. The site header survived for exactly the reason the rest did not: it lives in a
layout.

Everything below `main` being rebuilt is not only a rendering cost. The document list's polling
state, the source panel and scroll position are all client state in that subtree, and all of it
was discarded on a navigation between two views that differ by one section.

## Decision

Move the shell into `app/(app)/w/[workspaceId]/(workspace)/layout.tsx`. The chat is the only
per-route part.

**A route group, not the bare segment.** `/w/[workspaceId]/usage` is a sibling, and a layout at
`[workspaceId]` would have wrapped the usage dashboard in the document list and a chat panel.
`(workspace)` scopes the layout to the two chat routes without appearing in any URL.

**The shared document state moved into a client context.** `hasReadyDocuments` has to track
uploads as they finish, and a value computed in a layout would be frozen — the exact regression
`workspace-shell.test.tsx` still guards. The chat arrives as `children`, so the layout cannot pass
it props; context carries the live shell state, and everything the page can establish for itself
stays a prop.

**Each render entry authorizes itself**, through `requireWorkspace`. A layout is not an
authorization boundary: it and the page it wraps are separate renders, and a page trusting its
layout's check would be relying on something Next is free to render, skip or reuse independently.
Same misconception `proxy.ts` names for middleware.

**The conversation list reads the open chat from the URL.** A layout is never given the `chatId`
segment. `usePathname` is the answer, falling back to `chats[0]` — `listChats` orders by
`updatedAt` descending, so the first row is the one `/w/<id>` opened.

## What it cost, measured

Four runs each, same machine, same local Postgres, production build. Each run switches
conversations five times.

|                  | first switch          | steady-state median |
| ---------------- | --------------------- | ------------------- |
| Sibling segments | 396, 894, 898, 902 ms | 67, 68, 70, 71 ms   |
| Shared layout    | 98, 102, 119, 120 ms  | 83, 85, 85, 86 ms   |

**The first switch is ~8× faster. The steady state is ~16 ms slower.**

That is the opposite of the story this change was filed under. The remount was never expensive
once Next had the route payload cached client-side; what was expensive was the first time, and
that is the number a reader actually meets — the first switch in a session happened on every
session.

The ~16 ms regression afterwards is consistent across runs rather than noise, and **its cause is
unmeasured**. Plausible candidates are the shell re-rendering on `usePathname` where it previously
threw itself away, and reconciling a large subtree costing more than mounting a fresh one. Naming a
cause without instrumenting it would be the mistake this repository keeps recording, so it is
recorded as open instead.

**The backlog's 410 ms median described neither case.** Its samples — 143, 394, 410, 892, 906 —
mix first-navigation and steady-state measurements, so the median sat between two populations and
belonged to neither. Separating them is what made the real result visible.

## Consequences

**The justification is state, not speed.** The document list keeps polling across a conversation
change, the source panel stays open, and scroll position survives. On the steady-state number
alone this change would not pay for itself.

**A write that changes the layout's data now has to say so.** Next does not refetch a layout on a
client navigation — that is the whole saving — so `createConversation` wrote a row and redirected
to a page whose conversation list had been rendered before it existed. The new conversation was
missing until a turn completed or the reader reloaded. A `revalidatePath` on the workspace path,
scoped to `"layout"`, closes it — the same reasoning as `lib/theme/actions.ts`.

Found by use, not by the suite, and worth stating as the general rule: **anything that mutates what
the layout queries must invalidate the layout.** The other writers already do it by accident —
rename, delete and a finished turn all go through `router.refresh()`, which re-renders layouts too.
The action was the only one that navigated by redirecting instead.

**It unblocks the composer**, which the backlog already sequenced behind it — both touch this
surface, and doing the composer first would have meant doing it twice.

**`e2e/workspace-shell.spec.ts` guards it by node identity, not by time.** A threshold would assert
the speed of whichever machine ran it, which is the mistake `navigation.spec.ts` made and had moved
to a unit test. The probe tags four DOM nodes and reads them back: three must survive, and the chat
section — the per-route half — **must not**. That last assertion is the control, and without it the
test could pass while measuring nothing.

## What this is not

It is not a fix for the soft 404 on a missing workspace, which is a separate backlog entry and is
about `notFound()` reaching the client after headers have gone. Moving the check into a layout does
not change when it runs.
