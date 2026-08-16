/**
 * Refuses to let the integration suite run against a database it is not allowed
 * to destroy.
 *
 * `clearUsageEvents` deletes **every** row in `usage_events` — unscoped and
 * deliberately so, because the global-cap query reads every row and a leftover is
 * a wrong answer. That is correct against a throwaway database and destructive
 * against a real one, and nothing about the command says which it reached. The
 * same ambiguity has now cost this project a seed writing to the wrong database
 * twice and a redeploy aimed at the wrong connection string.
 *
 * CI needs no exemption: its service container is port-mapped, so `DATABASE_URL`
 * is already loopback there.
 */

/** Names the claim rather than the mechanism — setting it asserts the database is
 * disposable, which is the thing that has to be true. */
export const DISPOSABLE_OPT_IN = "INTEGRATION_DB_IS_DISPOSABLE";

/**
 * **Both**, because the suite reads both. Most code takes `DATABASE_URL`, but
 * `retrieve.integration.test.ts` builds its forced-plan connection from
 * `DATABASE_URL_UNPOOLED ?? DATABASE_URL` — startup options are rejected by a
 * pooler. Checking only the first left a guard that passed while a test connected
 * somewhere else entirely.
 */
const CHECKED_VARIABLES = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLoopbackDatabase(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname);
  } catch {
    // An unparseable URL is not a loopback one. The connection will fail with a
    // better message than this guard could write.
    return false;
  }
}

/**
 * Throws unless every connection variable the suite might read is loopback, or
 * the caller has explicitly said the database is disposable. Silent for a
 * variable that is unset — an absent target is the connection's problem to
 * report, not this one's.
 */
export function assertDisposableDatabase(env: {
  DATABASE_URL?: string | undefined;
  DATABASE_URL_UNPOOLED?: string | undefined;
  [key: string]: string | undefined;
}): void {
  if (env[DISPOSABLE_OPT_IN]?.trim().toLowerCase() === "yes") return;

  for (const name of CHECKED_VARIABLES) {
    const url = env[name];
    if (!url || isLoopbackDatabase(url)) continue;

    throw new Error(
      `Refusing to run integration tests: ${name} points at "${new URL(url).hostname}".\n\n` +
        `They delete every row in usage_events, so they must only ever reach a\n` +
        `disposable database. Start the local one:\n\n` +
        `  docker compose up -d && pnpm db:migrate\n\n` +
        `then set both DATABASE_URL and DATABASE_URL_UNPOOLED to it — .env.test.local\n` +
        `is read before .env.local and is the place for them. If this host really is\n` +
        `disposable, set ${DISPOSABLE_OPT_IN}=yes.`,
    );
  }
}
