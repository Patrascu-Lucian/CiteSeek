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
which fails a run in which no mutant was killed.

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

## Decision

**No threshold, in CI or anywhere.** `thresholds.break` is null. A score first measured this week is
not a number to pin, and a gate on it would reward tests that kill mutants over tests that catch
defects. The survivors are sorted next, each into one of four buckets: a test that cannot fail,
behavior nothing needs to assert, an equivalent mutant, or a mutant only a test outside this scope
would kill.

## Consequences

- **`pnpm test:mutation` is a local command for now.** Whether it also runs on a schedule is decided
  after the survivors are read.
- **The score is not a target.** 61 of the 162 undetected mutants are string literals, which the
  sorting has to read one at a time: some will be wording nothing should pin, some may be a message a
  reader relies on. Chasing a higher number would manufacture the decorative tests this exists to
  find.
- **The scope is two directories.** `lib/local`, the components and the routes are out, and the score
  says nothing about them.
