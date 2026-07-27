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
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: ["components/ui/**", "**/*.d.ts"],
      // The bar is >=90% for lib/rag and lib/ai -- the pure core of the project.
      // Those directories do not exist yet, so thresholds are deliberately left
      // off until Milestone 1: a threshold over an empty tree is theatre.
    },
  },
});
