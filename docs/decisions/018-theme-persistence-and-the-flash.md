# 018 — Theme persistence, and the flash it usually causes

**Status**: accepted · **Date**: 2026-08-03 · **Milestone**: 4

## Context

A `.dark` palette has existed in `globals.css` since the project was scaffolded and has been
unreachable the whole time — no class was ever set on the document, so every token in it was dead
CSS. Making it reachable is one line. Making it reachable **without a flash of the wrong palette
on every page load** is the actual decision.

The flash has a specific cause. The server renders HTML before it knows anything about the
reader's preference, so the first paint uses whichever palette is the default. A moment later the
client reads the stored choice and corrects it. On a fast connection that is a blink; on a slow
one it is a white page that turns dark after the text has already been read, and it happens on
every navigation rather than once per session.

## Options

**`localStorage` plus a render-blocking inline script.** The standard implementation, and what
`next-themes` does. A small script in `<head>` reads storage and sets the class before the browser
paints. It works, and it costs: a script that must block rendering by design, `suppressHydration-
Warning` on `<html>` because the server's markup is knowingly wrong, and nothing at all for a
reader with JavaScript disabled. It is also the thing Lighthouse's render-blocking audit exists to
find, on a project whose README quotes Lighthouse numbers.

**A media query alone.** `@media (prefers-color-scheme: dark)` with no class. Zero JavaScript, no
flash, and no way to disagree with the operating system — which is the entire feature. Someone on
a dark desktop who wants this one app light has nowhere to say so.

**A cookie, read on the server.** Chosen.

## Decision

The preference is a **cookie**, read in the root layout, written to `<html>` as a class before the
first byte leaves the server. The palette is therefore correct in the first paint of every
response, with **no inline script, no `suppressHydrationWarning`, and nothing to correct**.

A cookie is the only client-side storage the server can see. That single property is what removes
the flash rather than hiding it: there is no wrong first paint to overwrite.

Three values, because "system" is a real answer rather than the absence of one. A reader who picks
it wants the OS followed _from now on_, including when it flips at sunset — collapsing it into a
default would freeze whatever the OS said at the moment they last clicked.

- `dark` → `class="dark"`
- `light` → `class="light"`
- `system` → **no class**, which hands the decision to `prefers-color-scheme` in CSS

The control is a form of three submit buttons posting to a server action, so it works with
JavaScript disabled: the form posts, the cookie is set, the page returns already repainted.

## Consequences

**The dark palette is written twice**, once under `.dark` and once under
`@media (prefers-color-scheme: dark) { :root:not(.light) }`. A media query is not a selector, so
there is no way to write one rule matching both cases — the duplication is forced by CSS rather
than chosen. It is guarded by a unit test that parses `globals.css` and fails if the two blocks
ever define different variables or different values. Without that guard the failure would be
silent and late: add a token to one block, and readers in the other mode get an unstyled fragment
while the app looks correct in whichever mode you happened to be testing.

**`:not(.light)` is load-bearing.** It is what lets an explicit light choice beat a dark operating
system. Without it the media query repaints over the reader's choice and the toggle appears broken
on exactly the machines where someone would reach for it.

**The `dark` variant matches descendants, not the root.** `@custom-variant dark (&:is(.dark *))`
means `body` and everything under it match while `html` itself does not — which is why the base
layer paints `body`. Moving that paint to `html` would leave the page background stuck in the
light palette while every component switched around it.

**The accessibility surface doubles, and that is the real cost.** A contrast pair that passes in
one palette can fail in the other, and axe passes both when a chip is drawn in the color of the
bubble behind it. `e2e/a11y.spec.ts` is parameterized over both themes rather than duplicated —
including the two hand-written checks that exist precisely because axe cannot see affordance. A
test asserting the rendered class guards the parameterization itself, so a broken cookie cannot
quietly run the light palette twice and report coverage of both.

**A cookie is sent on every request.** Twenty-odd bytes, on a site that already sets a session
cookie. It is also not `httpOnly`, deliberately: it carries no authority, and a future client-side
toggle should be able to read it without a round trip.

**The logo is inverted rather than swapped.** The placeholder wordmark is an SVG whose every
fill is the same `#1A1A1A`, so `invert` is exact rather than approximate — there is no hue for
it to distort — and one asset covers both palettes with no second file to keep in step. That is a
property of this artwork, not a general rule: the moment the mark carries a brand color, inversion
stops being correct and it needs either two assets or inline SVG driven by `currentColor`. The
raster it replaced had **no transparent pixels at all**, which forced a white plate in both
palettes and put every filter-based approach out of reach.

↳ **Amended:** the wordmark is now text rather than an image, so nothing is inverted and the
constraint above no longer binds. The reason was not the palette — the placeholder read "LOGO",
which left the product's name absent from its own header. Text follows the theme with no second
asset, and the tradeoff recorded here applies again the moment a real mark is introduced.
