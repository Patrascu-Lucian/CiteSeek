# Mutation testing

Run 2026-11-25 by `pnpm test:mutation`, over `lib/rag` and `lib/ai`; the
exclusions are in `stryker.config.mjs`.

**91.66%** of **1297 mutants** detected.

1297 mutants: 1178 killed, 103 survived, 5 without coverage, 9 timed out, 2 ignored or errored.

A mutant is a deliberate change to the code, and a detected one is a change some
test noticed. Coverage says only that a line ran.
