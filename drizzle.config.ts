import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next, so nothing has loaded .env.local for it. Using
// Next's own loader rather than dotenv keeps file precedence identical to the
// app's (.env.local wins over .env), so the CLI and the running app can never
// disagree about which database they are pointed at.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  // Emits reviewable SQL files rather than pushing schema straight at the
  // database. `drizzle-kit push` is convenient in dev and unauditable in prod;
  // migrations in the repo are what make a deploy safe to reason about.
  strict: true,
  verbose: true,
});
