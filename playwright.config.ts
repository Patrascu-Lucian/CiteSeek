import { defineConfig, devices } from "@playwright/test";

import { assertDisposableDatabase } from "./lib/env/disposable-database.ts";
import { loadLocalEnv } from "./lib/env/load-local-env.ts";

// The signed-in specs connect from `DATABASE_URL`, which nothing here set — so
// they only ever ran in CI. Order matters: `loadEnvFile` never overwrites, so the
// disposable URL wins over the `.env.local` pointing at Neon.
loadLocalEnv(".env.test.local");
loadLocalEnv();

/* Here, not only in `e2e/signed-in.ts`: that runs when a spec imports the
   fixture and after the server has booted, while the server reads `.env.local`
   itself. Loading those files is what made a Neon URL reachable from a local
   run, so the check belongs where the loading happens. */
assertDisposableDatabase(process.env);

// Overridable so the suite can run while a dev server holds 3000.
const PORT = Number(process.env.E2E_PORT ?? 3000);
// `localhost`, not `127.0.0.1`: Next normalizes redirects to the host it was
// started on, so a test on 127.0.0.1 loses its cookies at the origin boundary.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Playwright empties `outputDir` each run and its default is `test-results/`,
  // where the vitest reports land — so this was deleting them.
  outputDir: "test-results/playwright",
  // Runs after `webServer` accepts connections, which is not the same as being
  // ready to answer — the first vector search is the cost. See the file.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // Coupled to `retries` above: `on-first-retry` produces nothing locally,
    // where there is no retry, so a local flake left no trace to read.
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // A production build: dev-mode timings would not be representative of the
  // TTFT numbers measured elsewhere.
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: baseURL,
    // `env` reaches only a server Playwright spawns: a stray one attaches without
    // it and the suite fails on "capacity reached", with nothing naming the cause.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Every spec arrives from one address, so any honest cap fails the suite.
      // `off` still runs the queries; integration tests cover the 429 paths.
      USAGE_LIMITS: "off",
      // Pinned, not inherited: unset means the real provider, and the server now
      // reads `.env.local`. "The answer cites [1]" against a real model is a coin
      // toss that spends quota.
      EMBEDDINGS_PROVIDER: "fake",
      CHAT_PROVIDER: "fake",
    },
  },
});
