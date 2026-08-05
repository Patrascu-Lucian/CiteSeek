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
 * the client on globalThis, each reload opens a fresh pool and the database runs
 * out of connections after a few dozen saves. Production creates it once, so the
 * guard is dev-only.
 */
const globalForDb = globalThis as unknown as {
  __citeseekClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__citeseekClient ??
  postgres(connectionString, {
    // Serverless invocations are single-request; a pool per invocation holds
    // connections Neon would rather reuse. Locally a small pool is fine.
    max: process.env.NODE_ENV === "production" ? 1 : 10,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__citeseekClient = client;
}

/**
 * Note: postgres.js does not open a connection here -- it connects lazily on the
 * first query. So importing this module is cheap, but it does require
 * DATABASE_URL to be *set*, because `next build` evaluates route modules to
 * collect page data. CI therefore passes a non-connectable placeholder to the
 * build step, mirroring how Vercel injects real env vars at build time.
 */
export const db = drizzle(client, { schema });

export * from "./schema";
