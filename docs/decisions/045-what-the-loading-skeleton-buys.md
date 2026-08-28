# 045 — What the loading skeleton buys, and what it costs

**Status**: accepted · **Date**: 2026-08-26 · **Version**: 1.4.2

## Context

`app/(app)/w/[workspaceId]/loading.tsx` is the largest single deduction on the workspace route's
Lighthouse score. It makes the segment a Suspense boundary, so the skeleton is streamed and paints
first while the real content arrives inside `<div hidden id="S:0">` and waits for React's `$RC(`
swap script. Hidden content cannot paint, so largest contentful paint waits on that script: on the
deployed app that is 636 ms to first byte against 2,100 ms of render delay, LCP 2.7 s.

The table below is a **different measurement** — one local production build, three runs each, on a
busier machine, which is why its LCP is 3.8 s rather than 2.7 s. Read it against itself and not
against the deployed figure. On every metric it separates, the boundary is the worse column:

| `/w/[id]` guest, local   | with `loading.tsx` | without    |
| ------------------------ | ------------------ | ---------- |
| Performance, median      | 87                 | **92**     |
| First contentful paint   | 1.0 s              | **0.8 s**  |
| Largest contentful paint | 3.8 s              | **3.3 s**  |
| Cumulative layout shift  | 0                  | 0          |
| Total blocking time      | 130 ms             | **100 ms** |
| Speed index              | 1.0 s              | **0.8 s**  |

Layout shift is the row that separates nothing, and that is the finding: this file was believed to
be what held it at 0, and it is not. Without the boundary nothing streams in late, so the footer is
in its final place at first paint and the shift never happens either way.

That table is the whole of what Lighthouse can see, and on its own it says delete the file.

## Decision

Keep the boundary. It is worth about five Lighthouse points because it buys something the score
never sees: **Lighthouse as run here only ever performs a cold full-page load, and the skeleton
exists for a navigation.** (Lighthouse user flows can time a client-side navigation; the CLI's
default navigation mode, which `scripts/measure-lighthouse.mts` shells out to, cannot.)

Entering `/w/[id]` from `/account` — a header link, the ordinary way in — on a connection throttled
to 400 ms latency and 4× CPU, five runs each:

| Entering the workspace | with `loading.tsx` | without  |
| ---------------------- | ------------------ | -------- |
| Progress bar appears   | 290 ms             | 285 ms   |
| Destination commits    | **460 ms**         | 1,670 ms |
| Content visible        | 2,150 ms           | 2,150 ms |

Time to content is the same either way. What differs is when the destination arrives — the URL and
the shell of the page that was clicked.

**The bar fires in both columns**, so this is not a choice between feedback and none. Without the
boundary the reader spends those 1.2 s on the page they navigated away from, under
[ADR 024](024-a-bar-for-the-gap-before-a-route-paints.md)'s progress bar. Anyone re-measuring this
has to instrument that bar as well as `[aria-busy]`: watch for the skeleton alone and the result
reads "nothing on screen at all", which is both false and convincing.

So the trade is narrow, and worth stating at its real size: a bar says work is happening; the
skeleton says the work is the page you asked for. Five Lighthouse points for 1.2 s of that
distinction is worth paying — but it is a margin, not a rout, and the next thing that narrows it
should reopen this.

## What the boundary does not do

**It never appears when switching conversations**, which is the most frequent navigation in the
app. `/w/[id]/c/1` → `/w/[id]/c/2` measured `skeletonShown: 0` across ten runs, with the boundary
and without it. React shows a fallback for a boundary being _mounted_; this one is already mounted,
and a transition updating it keeps the old content on screen instead. The skeleton is feedback for
entering the segment, not for moving inside it.

It is not silent, though — the progress bar covers it, rising at ~300 ms against a ~600 ms
navigation. What it lacks is anything identifying _which_ conversation is being opened.

↳ **Amended, 27 August 2026.** That gap is now closed, and it does not trigger the reversal below.
The conversation list marks the row being opened and dims the others, so the switch names its
destination. The condition in _Consequences_ is about the **progress bar** naming a destination on
the way _into_ the workspace, which is the navigation this decision was measured on. A row naming
itself inside the workspace is a different surface and a different navigation, and the boundary
still buys the 1.2 s it was kept for. Putting `useLinkStatus` on the header's Workspace link
**would** trigger it, which is why that was left alone.

## Consequences

- The workspace route scores about five points below what it could, permanently and on purpose.
  The README says so rather than quoting the higher number.
- `e2e/workspace-shell.spec.ts` guards **that the skeleton appears** on entry, and only that. It was
  falsified by deleting `loading.tsx` before it was kept. It does not time the commit, so the 460 ms
  this decision is bought with could regress to 1,670 ms with the test still green.
- If the progress bar ever becomes route-aware — naming its destination rather than only reporting
  that a fetch is open — the skeleton stops paying for itself and this should be reversed.

## What this replaces

The gap between first paint and largest paint has been explained wrongly three times: bundle weight
for four versions, then the footer, then a supposed hold on layout shift that measuring disproved.
Each was replaced by a measurement rather than by a better argument.

Which is why the tables above carry two instruments and not one. A measurement says nothing about
what it was never pointed at, and that silence reads as a fact about the page. **Name what a harness
cannot see before quoting what it did**: watching for the skeleton alone, a shipped progress bar
with its own ADR and its own E2E did not exist as far as the numbers were concerned.
