import { defineConfig, devices } from "@playwright/test";

// Overridable so the suite can run while a dev server holds 3000.
const PORT = Number(process.env.E2E_PORT ?? 3000);
// `localhost`, not `127.0.0.1`: Next normalizes redirects to the host it was
// started on, so a test on 127.0.0.1 loses its cookies at the origin boundary.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
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
  // A production build: dev-mode timings would not be representative of the
  // TTFT numbers measured elsewhere.
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: baseURL,
    /*
      `env` below applies only to a server Playwright spawns, so reusing a stray
      one attaches without `USAGE_LIMITS=off` and the suite fails on "capacity
      reached" — a symptom with no visible link to the cause. Three debugging
      sessions before that was spotted. The trade is a start per run.
    */
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Every spec arrives from one address and CI retries twice, so any honest
      // cap would fail the suite for being one. `off` does not skip the check —
      // the queries still run — and integration tests cover the 429 paths.
      USAGE_LIMITS: "off",
    },
  },
});
