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

## Consequences

Wrapping global `fetch` is invasive, and it is the only way to observe the App Router's requests
— there are no router events. The wrapper restores the original on unmount and passes everything
it does not recognize straight through.

Excluding prefetches by header couples this to a Next implementation detail. If that header is
renamed, the bar starts flashing on every arrival rather than failing silently, which is the
right way round: the regression is visible.

Two Playwright tests hold the pair that matters — the bar rises during a navigation, and it stays
down through the prefetch burst on arrival. The second is the one that would otherwise rot.
