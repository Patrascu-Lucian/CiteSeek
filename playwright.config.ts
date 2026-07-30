import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
// `localhost`, not `127.0.0.1`: Next normalizes redirect targets to the host it
// was started on, so a test browsing 127.0.0.1 would be redirected to localhost
// and lose its cookies at the origin boundary. Chrome treats localhost as a
// secure context, so `Secure` cookies still work over plain HTTP here.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Fail the build if a `test.only` was committed by accident.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Run against a production build: dev-mode timings are not representative,
  // and TTFT numbers in Milestone 3 have to be measured against real output.
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Every spec arrives from one address, against one demo workspace, and CI
      // retries twice — so any honest per-minute cap would fail this suite for
      // being a test suite. Loosening the production numbers until it fits would
      // be tuning the product to its tests, so the harness declares its own
      // configuration instead. The 429 paths are covered by integration tests,
      // which can seed usage rows directly.
      //
      // `off` does not skip the check: the counting queries still run and the
      // decision is still made, so these specs prove enforcement does not break
      // the happy path.
      USAGE_LIMITS: "off",
    },
  },
});
