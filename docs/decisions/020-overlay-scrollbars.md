# 020 — An overlay scrollbar instead of the platform's

## Context

`scrollbar-gutter: stable` was set on `<html>` to stop the layout shifting by the
scrollbar's width when a page grew past the fold. It worked, and it cost something
nobody had looked at: the gutter is reserved _outside_ the document's content box, and
no element can paint into it.

The visible result was the header. Its bottom border is full-bleed, so it ran to the
edge of the content box and stopped there — **measured at 1270px in a 1280px window** —
leaving a 10px strip of bare background past the end of the rule, on every page. The
footer's top border did the same. On a page short enough not to scroll there was not
even a thumb in the strip to explain it, so it read as a rendering fault rather than as
a scrollbar.

The obvious fix is to make the scrollbar overlay the content rather than displace it.
There is no CSS for that. `::-webkit-scrollbar` pseudo-elements cannot be positioned,
`overflow: overlay` was removed from Chromium, and on Windows and Linux a native
scrollbar is always a "classic" one that takes its width out of the scrollport. macOS
and headless Chromium overlay theirs, which is why this looked fine everywhere it was
checked before a real Windows browser.

## Options

1. **Keep the gutter, stop the borders running full-bleed.** Scope the header and footer
   rules to the same `max-w-5xl` column as their contents, so nothing ends near the
   window edge and the 10px becomes imperceptible. Four lines, no behavior change, and it
   hides the fact rather than removing it. Changes the design from full-width rules to a
   centered document.
2. **Move the page chrome out of the scroller.** `body { overflow: hidden }`, header
   above a single scroll region holding the page and footer. No JavaScript, native
   scrollbars kept. But the footer border still stops at the scrollbar, content is still
   inset, and the document scroller is what gives back/forward scroll restoration and
   the mobile URL-bar collapse — both lost, on long content pages (`/about`, `/privacy`,
   `/terms`) that are the ones which need them.
3. **Replace the native scrollbar.** Hide it app-wide and draw a thumb over the content.

## Choice

Option 3. `components/ui/overlay-scrollbar.tsx` renders a thumb positioned from
`scrollTop / scrollHeight / clientHeight`, over a `pointer-events: none` track, and
native scrollbars are hidden by `scrollbar-width: none` in `globals.css`.

Nothing is reserved, so nothing can shift — the property option 1 and the original
gutter were both buying is obtained by never taking the space in the first place, and
the header and footer reach the window edge on every route.

## Consequences

- **A widget we own.** Drag-to-scroll had to be implemented; wheel, keyboard, touch and
  find-in-page are untouched because the element is still a real scroll container.
- **The thumb is `aria-hidden` and hit-testable only on the thumb itself.** It duplicates
  scrolling that keyboard and screen-reader users have without it, and the native control
  it replaces is not in the accessibility tree either. A full-height strip that swallowed
  clicks would have broken every control near the right edge, so the track is
  `pointer-events: none`.
- **The arithmetic is a pure module** (`lib/ui/scroll-thumb.ts`). jsdom reports every
  scroll metric as 0, so a component test cannot distinguish a correct thumb from a
  collapsed one; the numbers are unit-tested and the component is left to wiring.
- **The guard is geometric, not stylistic.** `e2e/scrollbars.spec.ts` asserts the header
  and footer right edges equal `window.innerWidth`, which also catches any future change
  that reintroduces a space-taking scrollbar. Verified by putting the old declaration
  back: three tests fail, and pass again when it is removed.
- **Fixed along the way:** the declaration this replaces claimed all three scrollbar
  properties inherit. Only `scrollbar-color` does, so the composer and the source panel
  had full-width native scrollbars that had merely been recolored. See
  `docs/code-review-notes.md`.
