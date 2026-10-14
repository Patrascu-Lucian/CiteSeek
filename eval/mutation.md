# Mutation testing

Run 2026-10-14 by `pnpm test:mutation`, over `lib/rag` and `lib/ai`; the
exclusions are in `stryker.config.mjs`.

**87.14%** of **910 mutants** detected.

910 mutants: 784 killed, 112 survived, 5 without coverage, 9 timed out, 0 ignored or errored.

A mutant is a deliberate change to the code, and a detected one is a change some
test noticed. Coverage says only that a line ran.
