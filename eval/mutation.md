# Mutation testing

Run 2026-10-14 by `pnpm test:mutation`, over `lib/rag` and `lib/ai`; the
exclusions are in `stryker.config.mjs`.

**87.65%** of **939 mutants** detected.

939 mutants: 814 killed, 111 survived, 5 without coverage, 9 timed out, 0 ignored or errored.

A mutant is a deliberate change to the code, and a detected one is a change some
test noticed. Coverage says only that a line ran.
