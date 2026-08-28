import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolves the `@/*` alias from tsconfig.json natively (Vite 8+), so the
  // alias table lives in exactly one place.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    /*
      A flake here costs the pull request: nothing retries this suite, and the
      `e2e` job needs it. The default reporter's output is a stream — CI keeps no
      log and a local `| grep` threw one away — so the run also writes a file the
      failure can be read out of afterward. `outputFile` is required; without it
      the junit reporter prints to the same stream. Uploaded by `ci.yml`.
    */
    reporters: [
      "default",
      ["junit", { outputFile: "test-results/unit.junit.xml" }],
    ],
    /*
      Above Vitest's 5s default, which measured contention rather than
      correctness: the extraction specs do ~225ms of work and run in 1.6s alone,
      but were observed at 8-9s under the full suite. 15s still catches a hang.
    */
    testTimeout: 15_000,
    // Playwright owns e2e/. Without this, Vitest tries to collect those specs
    // and fails on Playwright's `test` fixture API.
    // Integration tests need a live database and run from their own config, so
    // `pnpm test` stays runnable with no infrastructure.
    exclude: [
      "e2e/**",
      "node_modules/**",
      ".next/**",
      "**/*.integration.test.ts",
    ],
    env: {
      // The unit suite never calls a real provider. Setting this here rather
      // than expecting `EMBEDDINGS_PROVIDER=fake` on the command line means
      // `pnpm test` works on a fresh clone with no API key -- and that a test
      // which accidentally reaches for the network fails loudly instead of
      // quietly spending quota.
      EMBEDDINGS_PROVIDER: "fake",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: [
        "components/ui/**",
        "**/*.d.ts",
        // Orchestration over database calls, covered by the matching
        // `*.integration.test.ts`. Unit-testing them would mean mocking every
        // query helper and asserting the mocks were called, which proves the
        // mocks work. `retrieve.ts` is almost entirely SQL: its invariants are
        // answerable only by a database executing it.
        "lib/rag/ingest.ts",
        "lib/rag/retrieve.ts",
        // The lexical twin of `retrieve.ts`, and excluded on the same grounds:
        // a `to_tsquery` against a real index, whose only interesting claims
        // need Postgres to answer. It has no caller in the product at all —
        // ADR 021 measured hybrid retrieval and did not ship it — so its only
        // exercise is `pnpm eval:retrieval`, which the unit suite never runs.
        // Left in the include list it scores 0% and, being pure SQL, dragged
        // `lib/rag/**` branches to 86% and held this gate red.
        "lib/rag/lexical.ts",
      ],
      // >=90% on the pure core, enabled now that it exists -- a threshold over
      // an empty tree passes vacuously and proves nothing.
      //
      // Scoped by glob rather than set globally: `lib/db` and `lib/auth` are
      // covered by integration and E2E tests, which run from other configs, so
      // a global threshold here would measure the wrong thing and push toward
      // writing unit tests for code whose behavior only means something against
      // a real database.
      thresholds: {
        "lib/rag/**": {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        "lib/ai/**": {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        "lib/local/**": {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
