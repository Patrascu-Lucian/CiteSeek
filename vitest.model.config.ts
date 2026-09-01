import { defineConfig } from "vitest/config";

/** Its own suite because it downloads 31 MB, which `pnpm test` must not, and
 * because the integration config demands a database this needs none of. */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Node: `loadChatModel` takes the filesystem cache path here, not a browser.
    environment: "node",
    globals: true,
    include: ["**/*.model.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    // One process holds one pipeline: `loadChatModel` is a module singleton and
    // refuses a second configuration, so parallel files would fight over it.
    fileParallelism: false,
    reporters: [
      "default",
      ["junit", { outputFile: "test-results/model.junit.xml" }],
    ],
    // A cold cache fetches weights before the first assertion runs.
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
