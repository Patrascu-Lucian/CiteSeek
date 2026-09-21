# 057 — What the landing page is for

## Context

The landing page is the only page a stranger reads before deciding whether anything else here is
worth their time. It had been written as a hero, three feature cards and a sign-in button: true
about the product, and indistinguishable from any other page making the same claims.

The product's entire argument is that an answer should be checkable. A page that asks to be taken on
trust argues against it.

Two facts shaped what the page could honestly do.

**There is no audience to convert yet.** `pnpm db:usage` against production on 18 September 2026
reports, for all time: 5 guest addresses, 126 guest requests, 2 signed-in accounts and 55 signed-in
requests. One account is the author's. A guest is an `HMAC-SHA256` of an address, so those five are
five addresses rather than five people, and `pnpm demo:shots` runs against production, so some of
the guest requests are a screenshot refresh. Read honestly, the readers are the author. Nothing on
this page can be chosen by conversion data, because there is no conversion data.

**The numbers this project has are real and already committed.** `README.md` §Numbers and
`eval/report.md` hold latency measured from a European vantage point, a retrieval sweep, a refusal
harness and a mutation score — each the output of a command anyone can re-run.

## The options for proof

**Testimonials or logos.** There are none. Writing them would be fabricating evidence on the page
that claims answers cannot be fabricated. Rejected on the spot, and recorded here because it is the
default move and the reason it is wrong is the product's own thesis.

**Usage figures.** "N documents searched", "N questions answered". True numbers exist, and they
describe the author using his own project. A count that implies an audience there isn't is a lie
told with real data.

**Measurements from committed runs.** Chosen. Every figure on the page is one a reader can find in a
file in this repository and reproduce with a documented command.

## Decision

The landing page has one job: **get a stranger to a cited answer without asking them for anything,
and make every claim on the way there checkable.**

That resolves the concrete questions as follows.

- **The demo is the primary action**, not sign-up. The filled button reaches the product; what it
  costs is a sentence underneath and the link's accessible description, not part of its label.
- **The page knows who is reading it.** A guest is not invited to start, and someone with an account
  is not offered a signup. This holds for the closing call to action as well as the hero.
- **Figures are quoted, not asserted.** `landing.test.tsx` looks each one up in `README.md` or
  `eval/report.md` and fails if it stops appearing there. A number typed on the page and nowhere
  else cannot ship.
- **The screenshot is the product**, not an illustration — the source panel open beside a cited
  answer, in both palettes, written by `pnpm demo:shots`.
- **`/about` carries the method.** The strip gives the figure; the page behind it says how each was
  taken and what it does not cover.

And what the page deliberately does not claim:

- **No count of readers**, per the baseline above.
- **No "zero invented citations".** `eval/refusals.md` measures refusals that do carry a marker, so
  that number is not zero. The claim that survives is the structural one: an unresolvable marker
  renders as plain text, and the refusal branch runs no model (ADR 055).
- **Not "EU-only".** Data is stored in Frankfurt; document text still reaches Gemini.
- **Recall at three passages, not eight.** Recall reaches 1.00 at the eight passages the route
  actually retrieves, and precision there is 0.14 over three documents. Quoting the ceiling cell of
  a table whose neighbors are worse is selection, which is the same move as a testimonial with extra
  steps. The page says 0.95 at three.

## Consequences

- **The page is tuned by cold readers and measurement, not by analytics.** Cold reader #1 produced
  ADR 022. A second is owed against the rebuilt page. With five addresses all-time, a funnel would
  be noise presented as a finding.
- **A stale number fails a test rather than sitting on the page.** The cost is that re-running an
  evaluation can turn a unit test red, which is the intended direction: the page cannot drift away
  from the reports while the suite is green.
- **The screenshot costs two Lighthouse points locally** — 96 to 94, LCP 2.7 s to 3.1 s, CLS 0. On a
  412 px viewport the figure is the largest paint wherever the section is placed; above the cards,
  below them, with `priority` and at a narrower width all measured 94. It is recorded rather than
  tuned away, and owed a re-measure on the deploy, where the last landing run was 98.
- **`next/image` means sharp is invoked now**, which two comments in `pnpm-workspace.yaml` had said
  it never was — one of them the reason its version floor exists. What it decodes is two PNGs
  committed here, not anything a reader supplies.
- **What would reopen this:** real traffic, which would make conversion measurable and a funnel
  honest; a testimonial that is actually given; or a corpus where a quoted figure stops holding, in
  which case the test says so first.
