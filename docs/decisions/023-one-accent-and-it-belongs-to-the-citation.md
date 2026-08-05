# 023 — One accent, and it belongs to the citation

## Context

The palette had no brand color at all. Every token was `oklch(… 0 0)` — chroma zero, pure
grayscale — except `--destructive` and `--success`, which are status rather than identity. That
is the shadcn scaffold's default, unchanged since Milestone 0.

The interesting part is not that a color was missing. It is **what `--primary` already paints**:

- the pressed citation chip,
- the highlighted passage in the source panel (`bg-primary/20`),
- the reader's own message bubble,
- the usage bar.

The first two are the product. Click `[1]`, land on the highlighted text — that is the claim the
whole system exists to make, and it was rendered in the least distinctive color available.

## Options

**Stay grayscale.** Defensible; plenty of good products are near-monochrome, and it costs
nothing. But it reads as an untouched scaffold, and it leaves the citation looking like
furniture.

**Add a separate brand token** and paint it somewhere decorative — a header rule, a logo tint.
The color would then be unrelated to what the product does, which is how accents end up looking
arbitrary.

**Make the accent `--primary`.** One token, and it lands on the citation chip and its highlight
together, because those already share it.

## Decision

`--primary` becomes a deep indigo, and everything else stays grayscale. The rule is one
sentence: **grayscale, plus one color that means _this is the citation_** — with red and green
still reserved for status.

```
light  --primary: oklch(0.42 0.13 264)   --primary-foreground: oklch(0.985 0 0)
dark   --primary: oklch(0.78 0.11 264)   --primary-foreground: oklch(0.22 0.06 264)
```

**Dark mode is not "a lighter navy".** `--primary` inverts: in light it is a dark fill with near
-white text, in dark it is a _light_ fill with dark text. A navy fill on a near-black background
would fail contrast in the one place it matters most.

Measured rather than eyeballed, both themes, by painting each color onto a canvas so the `/20`
tint is composited rather than guessed:

| Surface                              | Light   | Dark    |
| ------------------------------------ | ------- | ------- |
| Reader's message bubble              | 8.26:1  | 8.65:1  |
| Citation chip, at rest               | 19.80:1 | 18.97:1 |
| Citation chip, pressed               | 8.26:1  | 8.65:1  |
| Highlighted passage, `bg-primary/20` | 14.15:1 | 11.48:1 |

The wordmark takes the accent too, and it is the only piece of chrome that does — 8.63:1 light,
9.85:1 dark, at 18px/400, so the 4.5:1 bar applies rather than the large-text 3:1.

**A filled or accent-outlined "Sign in" in the header was rejected.** The header persists on every
page, so an accented control there competes with whatever that page's real primary action is, and
on the workspace it would sit in the same color the citation means. Sign-in is already offered
where it becomes relevant — the read-only card says "Sign in to upload", and a refusal offers it
to a guest who has hit a wall. Those explain _why_; a permanent button only adds pressure. A logo
has no such problem, because it is not a control: identity in the mark, hierarchy in the buttons,
one color doing both jobs without the two meeting.

The highlight was the one expected to fail — a saturated tint at 20% behaves differently from a
gray at 20% — and it is the strongest of the set.

The 32 lines of `--sidebar-*` tokens went with this change. They came from the scaffold and no
component has ever read them.

## Consequences

Indigo is a conventional choice and will not be mistaken for a designed brand. That is accepted:
the point here is to stop the citation looking like furniture, not to win a color award. The
wordmark's typeface does more identity work than the palette does.

**A `transition-colors` on the chip made the first measurement wrong**, and the trap is worth
recording because it is invisible: sampling the moment `aria-pressed` flips reads the color the
animation _started_ from. Both themes reported the unpressed chip's 19.80:1 as though it were
the pressed one. The regression test polls instead of sampling once, and says why.
