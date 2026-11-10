// Explicit .ts extensions: the scripts run under type stripping, which does not
// rewrite specifiers.
import { loadLocalEnv } from "../env/load-local-env.ts";
import { namesHost } from "../env/named-host.ts";

/** What a script that writes to a database needs before it touches one: shared
 * by `db:seed` and `db:reembed`, so the rules below exist once. */

export type ScriptTarget = {
  connectionString: string;
  /** For a guard or a log line. Never the credentials. */
  hostname: string | null;
  /** As the shell exported them, before `.env.local` filled anything in. */
  exported: { provider: string | undefined; host: string | undefined };
};

/**
 * Loads `.env.local` and points every connection in the process at one database.
 * Call it before importing anything from `lib/` that reaches the database:
 * `lib/db/index.ts` throws at module load on a missing `DATABASE_URL`.
 */
export function targetDatabase(hostVariable: string): ScriptTarget {
  // Read before `.env.local` applies, so the guards can tell a deliberate export
  // from one the file supplied.
  const exported = {
    provider: process.env.EMBEDDINGS_PROVIDER,
    host: process.env[hostVariable],
  };

  loadLocalEnv();

  // Unpooled, like migrations. Falls back where no pooler exists (Docker, CI).
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }

  // One target for the whole script. Two paths reach the database — the
  // script's own client, and `lib/` helpers whose singleton reads `DATABASE_URL`
  // only — so `DATABASE_URL_UNPOOLED=<production>` used to split them and exit 0
  // having seeded nothing.
  process.env.DATABASE_URL = connectionString;

  return { connectionString, hostname: hostOf(connectionString), exported };
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

/** Which *database* — the mistake the embedder guard does not cover. Named from
 * the shell for the same reason: `.env.local` is what supplied the wrong one. */
export function assertHostWasChosen(guard: {
  hostname: string | null;
  named: string | undefined;
  variable: string;
  verb: string;
}): void {
  const { hostname, named, variable, verb } = guard;
  if (hostname === null || LOCAL_HOSTS.has(hostname)) return;

  if (namesHost(named, hostname)) return;

  throw new Error(
    [
      named
        ? `${variable} is "${named}" but this resolves to ${hostname}.`
        : `Refusing to ${verb} ${hostname} without naming it first.`,
      "",
      "Neon branches are clones: every id in the output is right against either",
      "one, so the host is the only thing that can be wrong. Name it:",
      "",
      `  export ${variable}=${hostname.split(".")[0]}`,
    ].join("\n"),
  );
}

/** **Provenance, not value**: an exported fake is a decision, one `.env.local`
 * supplied is an accident — so the escape hatch cannot live there. */
export function assertEmbedderWasChosen(guard: {
  resolved: string;
  exported: string | undefined;
  hostname: string | null;
  verb: string;
}): void {
  const { resolved, exported, hostname, verb } = guard;
  if (resolved !== "fake") return;
  if (exported?.trim().toLowerCase() === "fake") return;

  // An unparseable URL is the connection's problem to report, not this guard's.
  if (hostname === null || LOCAL_HOSTS.has(hostname)) return;

  throw new Error(
    [
      `Refusing to ${verb} ${hostname} with the fake embedder.`,
      "",
      "EMBEDDINGS_PROVIDER resolves to 'fake' from .env.local rather than your",
      "shell, and fake vectors are unretrievable by the real model. Say which:",
      "",
      "  export EMBEDDINGS_PROVIDER=google   # real embeddings (production)",
      "  export EMBEDDINGS_PROVIDER=fake     # deliberately fake (a scratch branch)",
    ].join("\n"),
  );
}
