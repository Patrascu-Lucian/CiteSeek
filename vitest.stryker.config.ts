import { defineConfig } from "vitest/config";

/**
 * The unit tests over the pure core, for `pnpm test:mutation` (ADR 056). Node
 * rather than jsdom: nothing here touches a DOM, and Stryker runs these tests
 * once per mutant, so environment setup is paid thousands of times over.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    include: ["lib/rag/**/*.test.ts", "lib/ai/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/*.model.test.ts"],
    // Both as in `vitest.config.ts`, for the reasons given there.
    server: { deps: { inline: ["next-auth"] } },
    env: { EMBEDDINGS_PROVIDER: "fake" },
  },
});
