# 056 — Mutation testing the pure core

## Context

Coverage gates `lib/rag`, `lib/ai` and `lib/local` at 90%, and it says one thing: the lines ran. It
says nothing about whether any test would notice them behaving differently. `docs/code-review-notes.md`
records tests, found by hand, that could not have failed on the bug they were written for, and each
was found the same way: break the code on purpose and see whether anything goes red.

Mutation testing is that discipline run mechanically. It changes the code one small way at a time —
a `<` to `<=`, a string emptied, a condition forced true — runs the tests that cover each change, and
counts the changes no test notices.

## Setup

- **Stryker 10 with its Vitest runner**, both pinned exactly, because the runner declares an exact
  peer on core.
- **Scope: `lib/rag` and `lib/ai`, minus five files.** `ingest.ts`, `retrieve.ts`, `lexical.ts` and
  `fake-chat-model.ts` are pinned only by integration tests, which Stryker does not run, so their
  mutants would survive for want of a runner rather than for want of a test. `types.ts` holds two ids
  imported by producer and consumer alike, so changing one is equivalent by construction.
  `fake-embedder.ts` stays in: its distances are calibrated, and the fake floor and the E2E suite rest
  on them.
- **Its own Vitest config**, `vitest.stryker.config.ts`: the unit tests for those two directories,
  under the node environment. Nothing there touches a DOM, and Stryker runs tests once per mutant, so
  jsdom's setup would be paid hundreds of times.
- **The plugin is resolved by file URL.** Stryker looks for plugins beside its own install, and
  pnpm's layout puts nothing there but core's own dependencies, so the first run found no test runner
  at all. `import.meta.resolve` in the config finds it from the project root instead.
- **The sandbox is excluded everywhere.** Stryker copies the repository into `.stryker-tmp/`, and a
  failed run leaves the copy behind, so the unit and integration configs, `tsconfig.json` and ESLint
  all skip it.

## The Vitest 5 hazard

stryker-js#6210, open: on Vitest 5 the runner's per-test filter matches nothing, so every covered
mutant survives. The score collapses with an unchanged suite, and a collapsed score reads as a
finding rather than as a broken instrument. Two guards: Dependabot ignores major bumps of `vitest`
and `@vitest/coverage-v8`, and `pnpm test:mutation` ends with `scripts/check-mutation-report.mts`,
which fails a run in which no covered mutant was killed.

↳ **Covered, not all, corrected 15 September 2026.** The check first counted every kill. Stryker
runs a static mutant against every test with no filter, so a run broken this way still kills those —
56 in the last report — and the check would have passed it. It now counts kills among the mutants
that are not static, which are the only ones the broken filter decides.

## Baseline, 14 September 2026

830 mutants in under two minutes, on 16 cores with 15 test runners. **80.5%** of mutants detected,
81.7% of those any test reaches. Nothing was fixed against it before it was recorded.

| file                          | mutants | killed | timeout | survived | no coverage | score  |
| ----------------------------- | ------- | ------ | ------- | -------- | ----------- | ------ |
| `lib/rag/chunking.ts`         | 136     | 85     | 8       | 43       | 0           | 68.4%  |
| `lib/ai/fake-embedder.ts`     | 67      | 25     | 0       | 42       | 0           | 37.3%  |
| `lib/ai/rewrite.ts`           | 65      | 42     | 0       | 22       | 1           | 64.6%  |
| `lib/rag/eval-metrics.ts`     | 122     | 106    | 0       | 13       | 3           | 86.9%  |
| `lib/rag/extract.ts`          | 61      | 48     | 0       | 8        | 5           | 78.7%  |
| `lib/ai/citations.ts`         | 70      | 62     | 0       | 6        | 2           | 88.6%  |
| `lib/ai/prompt.ts`            | 46      | 40     | 0       | 6        | 0           | 87.0%  |
| `lib/ai/provider.ts`          | 58      | 56     | 0       | 2        | 0           | 96.6%  |
| `lib/ai/question.ts`          | 36      | 34     | 0       | 2        | 0           | 94.4%  |
| `lib/rag/embeddings.ts`       | 37      | 35     | 0       | 2        | 0           | 94.6%  |
| `lib/rag/normalize.ts`        | 43      | 41     | 0       | 2        | 0           | 95.3%  |
| `lib/rag/retrieval-config.ts` | 2       | 1      | 0       | 0        | 1           | 50.0%  |
| `lib/rag/fusion.ts`           | 20      | 19     | 0       | 1        | 0           | 95.0%  |
| `lib/rag/vector.ts`           | 55      | 53     | 1       | 1        | 0           | 98.2%  |
| `lib/rag/highlight.ts`        | 12      | 12     | 0       | 0        | 0           | 100.0% |
| **all files**                 | 830     | 659    | 9       | 150      | 12          | 80.5%  |

111 of the 830 are static mutants — changes to module-level values, which rerun every test — and
Stryker estimated them at 68% of the time. They stay in. A static mutant is a real change to a real
value, and two minutes is affordable.

## The survivors, sorted

Every one of the 162 mutants the first run did not detect was read against the code and its tests
and put in one bucket. The sort was kept as data, matched to each mutant by file, line, mutation and
replacement, so every count below is a tally rather than an impression.

| bucket                                           | mutants |
| ------------------------------------------------ | ------- |
| an existing test that cannot fail on it          | 27      |
| no test for the behavior                         | 20      |
| behavior nothing needs to assert                 | 85      |
| equivalent: nothing observable changes           | 25      |
| detected only by tests outside the scoped config | 5       |

**Nine tests cannot fail on what they are named for.** Each passes against its mutants because its
fixture never reaches the path its name describes.

- `extract.test.ts`, _"explains that a text-free PDF probably needs OCR"_, feeds bytes unpdf cannot
  parse, so the corrupt-file branch answers, and the assertion's regex accepts that message too. The
  empty-text branch the test is named for has never run under test.
- `fusion.test.ts`, _"scores a rank-1 hit as 1/(k+1)"_, uses `toBeCloseTo`, whose default checks two
  decimal places. 1/61 and 1/59 agree to that, so reversing the rank order passes.
- `chunking.test.ts`:
  - _"falls back to sentences inside an oversized paragraph"_ checks count and size, which the
    arbitrary cut satisfies too.
  - _"never emits a chunk that is only whitespace"_: `\n{2,}` swallows the whole gap, so no
    whitespace-only segment ever forms.
  - _"does not start or end a chunk on whitespace"_: its paragraphs never start a segment on
    whitespace.
- `eval-metrics.test.ts`:
  - _"counts an expected passage as recalled when any chunk covers it"_ has one chunk and one
    passage, so "any" and "every" agree.
  - _"is false for touching edges"_ checks one argument order.
  - _"moves the threshold up one answerable question per refusal allowed"_, written this milestone,
    lists its cases already sorted.
- `rewrite.test.ts`, _"strips the quotes a model wraps its answer in"_, has no quote inside the
  question.

**Nine behaviors have no test:** the history the rewrite shows the model (the last six turns' text,
role-prefixed); a rewrite reply that opens with a blank line; `mean` over real values; an answerable
question with nothing retrieved; `cutSignal` admitting a question on the closest of several chunks; a
Word document with no text; short paragraphs merging after the first chunk; exactly
`MAX_CHUNKS_PER_DOCUMENT` chunks; and the embedding token count reaching the meter.

**85 are not worth a test:** 41 stopwords, one word each; 13 prompt wordings and passage layouts,
which the evals measure; 11 exact boundaries at internal sizes; 5 chunk cuts moved by whitespace that
trimming removes; 4 citation markers of 10 or more, which eight passages never produce; 6 error
names, causes and wordings; and 5 whitespace edges.

**25 are equivalent:** 12 guards whose alternative yields an empty or inverted range that is dropped;
5 unreachable fallbacks; 4 defaults the library already applies; and 4 that reach the same result by
another route.

**5 are caught, but only by tests the scoped run leaves out:** the citation link prefix by the chat
panel's tests, `maxDistanceFor` by local mode's transport, the paragraph merge by local mode's
end-to-end Markdown ingest, and `MAX_CHARS_PER_DOCUMENT` by the usage view. Finding those five meant
running every unit test against the same mutants, which took 14 minutes rather than under 2 — the
case for the scoped config, in one number.

**What the sort says.** Read as a percentage, 80.5% suggests a fifth of the code goes untested. The
sort says otherwise: half the undetected mutants are not worth a test, and a sixth change nothing.
The finding is the first bucket — nine tests, one of them written this milestone, that pass whether
or not the code does what their names say. Those, and the nine missing tests, are the work that
follows, and each is done when its mutants fail.

↳ **Chunking fixed, and doing it corrected the sort three times.** Four tests got fixtures that reach
their paths and two were added, and `chunking.ts` went from 43 undetected mutants to 23, each now
sorted as not worth a test, equivalent, or caught elsewhere. The counts above are the corrected ones:

- **The unbroken-run mutant is equivalent.** It seeds the piece list with a string, which has no
  offsets, and `flush` drops it before any chunk is built.
- **A guard sorted as equivalent is not.** `start <= range.end` gives a run that is an exact multiple
  of the maximum one extra chunk, a duplicate 100-character tail, which the exact-ceiling test now
  catches.
- **The merge arithmetic had no test that could catch it**, rather than one that could not fail.
  `piece.end + pending.start` equals the right answer whenever a chunk starts at zero, and every
  fixture merged only in its first chunk.

A sort is a hypothesis about a test until the test is written.

↳ **The rest of the first two buckets, fixed.** Every other module went the way chunking did: change
the fixture until its mutants fail it, add the test that was missing, and check by running Stryker on
that file alone. Measured over the whole scope with every change in place, **86.5%** of the 830
mutants are now detected, up from 80.5%, and 112 remain undetected against 162.

| file              | undetected before | after |
| ----------------- | ----------------- | ----- |
| `chunking.ts`     | 43                | 23    |
| `rewrite.ts`      | 23                | 14    |
| `eval-metrics.ts` | 16                | 2     |
| `extract.ts`      | 13                | 8     |
| `embeddings.ts`   | 2                 | 1     |
| `fusion.ts`       | 1                 | 0     |
| **all files**     | 162               | 112   |

Every mutant still undetected is one the sort set aside as not worth a test, equivalent, or caught
only outside the scoped config, and four of those were killed along the way by the new tests. There is
one addition. The corrupt-PDF message was killed at baseline only by the old OCR test, whose regex
accepted either message; with that test fixed it survives, as wording, like the Word message beside
it.

## Decision

**No threshold, in CI or anywhere.** `thresholds.break` is null. A score first measured this week is
not a number to pin, and a gate on it would reward tests that kill mutants over tests that catch
defects. The sort above is that reason in numbers: most of what the score counts against the suite
is not a missing test.

**Measured on every release, never on a pull request.** `.github/workflows/mutation.yml` runs
`pnpm test:mutation` on every push to `main`, which here means every release, and on demand. It writes
the score to the run's summary, keeps the HTML report for 30 days, and goes red only when no covered
mutant was killed. A pull request is the wrong place for it: a check there asks its author to make it
pass, and a survivor needs sorting first. Its first run, on the 1.8.0 release merge, took 1.9
minutes on a GitHub runner, about the same as locally.

A weekly schedule was the first choice, changed before it ever ran. A schedule runs on the default
branch, and `main` takes nothing but release merges, so every run between releases would have
measured the same code as the one before it.

## Consequences

- **The score moves when a release does.** Between releases the last run stands. Checking `develop`
  sooner is `pnpm test:mutation` locally, which takes about two minutes.
- **The score is not a target.** 61 of the 162 undetected mutants are string literals, and 56 of
  those sort among the not worth a test. Chasing a higher number would manufacture the decorative
  tests this exists to find.
- **The scope is two directories.** `lib/local`, the components and the routes are out, and the score
  says nothing about them.
