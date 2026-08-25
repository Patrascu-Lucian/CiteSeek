import { defineConfig } from "drizzle-kit";

import { loadLocalEnv } from "./lib/env/load-local-env.ts";

// drizzle-kit runs outside Next, so nothing has loaded .env.local for it.
loadLocalEnv();

/**
 * Migrations use the *unpooled* connection: Neon's pooled endpoint is PgBouncer
 * in transaction mode, which its own docs exclude for DDL. The app keeps the
 * pooled URL, which is what serverless connections are for. `DATABASE_URL_UNPOOLED`
 * is Neon's naming; with no pooler it falls back to the same place.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

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
