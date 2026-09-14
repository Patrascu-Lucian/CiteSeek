/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const config = {
  // A file URL resolved from here, not a package name: Stryker imports plugins
  // from core's own install, where pnpm's layout does not expose the runner.
  plugins: [import.meta.resolve("@stryker-mutator/vitest-runner")],
  testRunner: "vitest",
  vitest: { configFile: "vitest.stryker.config.ts" },
  coverageAnalysis: "perTest",
  mutate: [
    "lib/rag/**/*.ts",
    "lib/ai/**/*.ts",
    "!**/*.test.ts",
    // Pinned only by integration tests, which Stryker does not run: a mutant
    // here would survive for want of a runner, not for want of a test.
    "!lib/rag/ingest.ts",
    "!lib/rag/retrieve.ts",
    "!lib/rag/lexical.ts",
    "!lib/ai/fake-chat-model.ts",
    // Its two runtime values are imported by producer and consumer alike, so
    // changing one is equivalent by construction.
    "!lib/ai/types.ts",
  ],
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  tempDirName: ".stryker-tmp",
  // No threshold in the release that first measures the score (ADR 056).
  thresholds: { high: 80, low: 60, break: null },
};

export default config;
