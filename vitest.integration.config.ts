import { defineConfig } from "vitest/config";

import { loadLocalEnv } from "./lib/env/load-local-env.ts";

// Loaded here rather than inside the test file: the config is evaluated before
// worker processes fork, so DATABASE_URL is on process.env by the time any test
// module is imported.
loadLocalEnv();

/**
 * Integration tests run against a real Postgres with pgvector -- they exist to
 * verify the things a mock cannot: that the vector column really rejects a wrong
 * dimension, that foreign keys really cascade, that the partial unique index
 * really constrains. A mocked database would assert only that our own mock works.
 *
 * Kept in a separate config from the unit suite so `pnpm test` stays fast and
 * needs no database. CI runs both.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Node, not jsdom: there is no DOM here and jsdom would only slow it down.
    environment: "node",
    globals: true,
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    // A shared database is not safe to write from parallel workers.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      // Route tests exercise providers through the real code path rather than
      // injecting a stub, so the provider knobs have to be set here. Every other
      // integration suite passes its own embedder and is unaffected.
      //
      // The point is the same as in the unit config: a test that reaches for a
      // live provider should fail loudly on a missing key rather than quietly
      // spending quota against a real account.
      EMBEDDINGS_PROVIDER: "fake",
      CHAT_PROVIDER: "fake",
      // Usage recording hashes the client address with this, so the chat route
      // now needs it in every environment. It was invisible locally because
      // `loadLocalEnv()` reads `.env.local`, which CI does not have — the same
      // "my machine has a value CI does not" gap that has caught us before.
      //
      // A fixed literal rather than a generated one: these tests never verify a
      // signature, and a value that changed per run would make every hash in the
      // usage table unreproducible between them.
      AUTH_SECRET: "integration-tests-only-not-a-real-secret",
      ...(process.env.DATABASE_URL
        ? { DATABASE_URL: process.env.DATABASE_URL }
        : {}),
    },
  },
});
