# Mutation testing

Run 2026-10-22 by `pnpm test:mutation`, over `lib/rag` and `lib/ai`; the
exclusions are in `stryker.config.mjs`.

**89.09%** of **1027 mutants** detected.

1027 mutants: 905 killed, 107 survived, 5 without coverage, 10 timed out, 0 ignored or errored.

A mutant is a deliberate change to the code, and a detected one is a change some
test noticed. Coverage says only that a line ran.
