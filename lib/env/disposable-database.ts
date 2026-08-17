/**
 * Refuses to let the integration suite run against a database it may not destroy:
 * `clearUsageEvents` truncates `usage_events`, and nothing about the command says
 * which database it reached. CI needs no exemption — a service container is
 * port-mapped, so it is already loopback there.
 */

/** Names the claim, not the mechanism: setting it asserts the database is
 * disposable, which is the thing that has to be true. */
export const DISPOSABLE_OPT_IN = "INTEGRATION_DB_IS_DISPOSABLE";

/** Both, because the suite reads both — `retrieve.integration.test.ts` connects
 * through `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, since a pooler rejects the
 * startup options it needs. Checking only the first let a test reach Neon. */
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
