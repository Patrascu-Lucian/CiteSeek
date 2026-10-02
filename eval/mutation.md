# Mutation testing

Run 2026-10-02 by `pnpm test:mutation`, over `lib/rag` and `lib/ai`; the
exclusions are in `stryker.config.mjs`.

**86.33%** of **856 mutants** detected.

856 mutants: 730 killed, 112 survived, 5 without coverage, 9 timed out, 0 ignored or errored.

A mutant is a deliberate change to the code, and a detected one is a change some
test noticed. Coverage says only that a line ran.
