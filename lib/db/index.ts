import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

/**
 * Next.js dev-mode hot reload re-evaluates modules on every edit. Without caching
 * the client on globalThis, each reload opens a fresh connection pool and the
 * database runs out of connections after a few dozen saves. This is the standard
 * workaround; production creates the pool exactly once, so the guard is dev-only.
 */
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.client ??
  postgres(connectionString, {
    // Neon terminates idle connections; a bounded pool with a short idle timeout
    // keeps serverless invocations from holding sockets they are not using.
    max: process.env.NODE_ENV === "production" ? 1 : 10,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
export * from "./schema";
