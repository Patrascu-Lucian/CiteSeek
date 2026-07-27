import { defineConfig } from "drizzle-kit";

import { loadLocalEnv } from "./lib/env/load-local-env.ts";

// drizzle-kit runs outside Next, so nothing has loaded .env.local for it.
loadLocalEnv();

/**
 * Migrations use the *unpooled* connection.
 *
 * Neon's pooled endpoint is PgBouncer in transaction mode, and Neon's own docs
 * call out schema migrations as a case it does not support -- DDL wants a stable
 * session, which a transaction pooler does not give it. The app keeps using the
 * pooled URL, because serverless functions open many short-lived connections and
 * that is exactly what the pooler is for.
 *
 * `DATABASE_URL_UNPOOLED` is Neon's own naming, so their Vercel integration sets
 * it automatically. Locally and in CI there is no pooler, so it falls back to
 * DATABASE_URL and both point at the same place.
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
