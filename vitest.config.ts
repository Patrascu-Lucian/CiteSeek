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
      exclude: ["components/ui/**", "**/*.d.ts"],
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
      },
    },
  },
});
