# 024 — A bar for the gap before a route paints

## Context

Route changes felt slow. Measured against production rather than assumed, a `/demo` click from
the landing page looks like this:

```
   0ms   click
  31ms   → GET /demo?_rsc=…
 146ms   ← 307 redirect
 274ms   navigation commits
 340ms   the route's loading.tsx skeleton paints
 406ms   ← workspace RSC 200
```

The total is healthy. The problem is the first third of a second: **nothing on screen changes
between the click and 340ms.** The old page sits there through the RSC request, the redirect and
the commit, because `loading.tsx` cannot paint until the navigation has committed — a skeleton
is a Suspense fallback for the _new_ route, and until then there is no new route.

Two things make this worse than the numbers suggest. `/demo` and `/w` have prefetching disabled
on purpose (`lib/links.ts`) because they are GETs that write, so they always pay the full round
trip — and they are the two a stranger clicks first. And on a cold Vercel function the same
silent window is seconds, which is when people click twice.

## Options

**Fix the routes instead.** The right instinct, but there is nothing here to fix: 400ms warm
with a 115ms redirect hop is already fine. The gap is structural, not slow code.

**Re-enable prefetching on `/demo` and `/w`.** Would remove the round trip and reintroduce the
defect that disabling it fixed — a prefetcher firing a GET that writes.

**Watch clicks.** Simple, and it covers every `<Link>` without touching them. Rejected once
built: it misses `router.push`, back/forward and form posts, so whole classes of navigation get
no feedback at all.

## Decision

One indicator in the root layout, driven by **the router's own requests**: `fetch` is wrapped,
requests whose URL carries `?_rsc=` are counted while in flight, and the bar is up whenever that
count is above zero.

Watching clicks was the first attempt and was wrong. It covered anchors and therefore every
`<Link>`, but missed `router.push`, back/forward, and the form posts used wherever a GET would
write — "New conversation" is a form. Counting the requests covers all of them, because the
router fetches every route the same way.

**Prefetches are excluded by header, and that is the part that makes this workable.** Arriving
anywhere fires a burst of `?_rsc=` requests for links in the viewport — eight on the workspace —
and a bar reacting to those would flash constantly for work nobody is waiting on. Next marks a
prefetch `Next-Router-Prefetch: 1`; a real navigation carries no such header.

`useLinkStatus` would be the idiomatic answer and cannot be: it reads context from the `<Link>`
above it, so it only works inside that link's subtree and cannot drive one indicator from the
layout.

The trade this accepts: **it is feedback, not speed.** A bar makes a slow navigation feel
acknowledged, which is exactly what makes it dangerous — it can hide a genuinely slow route
behind the impression that something is happening. The numbers above are recorded here so that
"it feels fine now" is never mistaken for "it is fast".

It is `aria-hidden`. Each route's `loading.tsx` and its own live regions already say what is
happening to a screen reader, and a second announcement on every navigation is noise.

**It waits 200ms before appearing.** A bar on a navigation that resolves in 120ms is a flicker,
which is worse than no feedback — it reads as something going wrong rather than something being
loaded. Prefetched routes resolve from cache with no request at all, so most in-app navigation
shows nothing, which is correct: there is nothing to wait for. The bar is for the case that
actually stalls, which is `/demo` and `/w` cold.

## Measured afterward: how slow is the slow case

This ADR warned that a bar can hide a genuinely slow route, so the route was measured rather than
left to the bar. Cold against warm on production, clicking through to the demo workspace:

|                                    |                                                      |
| ---------------------------------- | ---------------------------------------------------- |
| Cold, after the site had been idle | **744ms**, and **1296ms** after a longer quiet spell |
| Warm, three consecutive            | 565ms, 238ms, 235ms                                  |
| Ratio                              | **3.1×**                                             |

The variance fits the hypothesis in `docs/backlog.md`: Neon's free tier suspends compute after
inactivity, so on a demo with sporadic traffic most visitors are the one who wakes the database.

**A second, heavier loading state at 1000ms was proposed and rejected on these numbers.** A cold
navigation lands between roughly 750ms and 1.3s, which the 200ms bar already covers end to end. An
escalation would fire on the tail of an ordinary cold start rather than on a stall — and if it
blocked interaction, it would trap a reader during a wait that resolves on its own, making the
loading state's failure mode worse than the failure it covers.

**It grows rather than appearing at width.** The first version set the final width inline with a
`transition`, which does nothing: a transition fires on a change and this element mounts at its
target. A keyframe runs on mount, so the fill animates from zero — measured growing 61px to 889px
across a held navigation, where before it was flat from the first frame. It also stays mounted
for 220ms after the request clears, so the fill runs to the end instead of vanishing at 70% —
measured reaching 1270 of 1280px before it goes.

## Consequences

Wrapping global `fetch` is invasive, and it is the only way to observe the App Router's requests
— there are no router events. The wrapper restores the original on unmount and passes everything
it does not recognize straight through.

Excluding prefetches by header couples this to a Next implementation detail. If that header is
renamed, the bar starts flashing on every arrival rather than failing silently, which is the
right way round: the regression is visible.

Three Playwright tests hold it: the bar rises during a slow navigation, stays down through the
prefetch burst on arrival, and stays down for a navigation that resolves quickly. The slow case
is forced by delaying the RSC request rather than hoping for a slow route — a threshold that only
shows on slow navigations cannot be observed reliably by waiting for a fast one.
