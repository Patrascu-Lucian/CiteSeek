/**
 * Fails the build when the database is behind the repo's migrations — 0001 was
 * applied to the dev branch only, and production returned bodiless 500s on upload
 * while the documents list kept working. **It checks; it does not migrate**: a
 * preview build would otherwise mutate whatever Preview points at, and failing at
 * startup would take the app down. A red deploy keeps the old version serving.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import { loadLocalEnv } from "../env/load-local-env.ts";

loadLocalEnv();

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set, so the migration state cannot be checked.",
  );
}

const JOURNAL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
  "meta",
  "_journal.json",
);

type Journal = { entries: { tag: string }[] };

/** `hnsw.iterative_scan` (ADR 026) arrived in pgvector 0.8.0. Below that, setting
 * it does not fail — the GUC is unregistered, so Postgres keeps it as a custom
 * placeholder and drops it when the library loads. Retrieval then silently
 * under-retrieves for small tenants with an ADR in the repo saying it does not. */
const REQUIRED_VECTOR_VERSION = [0, 8, 0];

function isBelowRequired(version: string): boolean {
  const parts = version.split(".").map(Number);

  for (const [index, required] of REQUIRED_VECTOR_VERSION.entries()) {
    const part = parts[index] ?? 0;
    if (Number.isNaN(part)) return false;
    if (part !== required) return part < required;
  }

  return false;
}

function targetHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "an unparseable DATABASE_URL";
  }
}

/** An extension stays at the version it was created at — `CREATE EXTENSION` in
 * migration 0000 pins it, and a newer server does not upgrade it. */
async function checkVectorVersion(client: postgres.Sql) {
  const [row] = await client<{ extversion: string }[]>`
    select extversion from pg_extension where extname = 'vector'
  `;

  const version = row?.extversion;

  if (!version) {
    console.error("\nThe `vector` extension is not installed.\n");
    process.exitCode = 1;
    return;
  }

  if (isBelowRequired(version)) {
    console.error(
      [
        "",
        `pgvector is ${version}; retrieval needs 0.8.0 or newer.`,
        "",
        "`hnsw.iterative_scan` does not exist below 0.8, and setting an unknown",
        "parameter is not an error — it is accepted and discarded. Retrieval would",
        "keep working and quietly return too few passages for a small workspace,",
        "which reads as the relevance floor refusing the question.",
        "",
        "  ALTER EXTENSION vector UPDATE;",
        "",
      ].join("\n"),
    );

    process.exitCode = 1;
    return;
  }

  console.log(`pgvector ${version}.`);
}

async function main() {
  const journal = JSON.parse(await readFile(JOURNAL_PATH, "utf8")) as Journal;
  const expected = journal.entries.map((entry) => entry.tag);

  console.log(
    `Checking ${targetHost(connectionString!)} against ${expected.length} migration(s).`,
  );

  const client = postgres(connectionString!, { max: 1 });

  try {
    // Before the migration count, not after it: on a database that is behind,
    // the operator is about to migrate, and finding out afterward that the
    // extension is too old to serve the result costs a second round trip.
    await checkVectorVersion(client);

    // One row per applied migration. No table at all means never migrated, which
    // is the answer rather than an error worth surfacing raw.
    const [row] = await client<{ applied: number }[]>`
      select count(*)::int as applied
      from drizzle.__drizzle_migrations
    `.catch(() => [{ applied: 0 }]);

    const applied = row?.applied ?? 0;

    if (applied >= expected.length) {
      console.log(`Up to date — ${applied} applied.`);
      return;
    }

    // Named rather than counted: "you are two behind" sends someone hunting,
    // "0002 and 0003 are missing" does not.
    const missing = expected.slice(applied);

    console.error(
      [
        "",
        `Database is behind: ${applied} of ${expected.length} migrations applied.`,
        `Missing: ${missing.join(", ")}`,
        "",
        "Deploying now would ship code against a schema that cannot serve it,",
        "which surfaces as unexplained 500s on the first request that touches a",
        "new column. Apply them first:",
        "",
        "  pnpm db:migrate",
        "",
      ].join("\n"),
    );

    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Drift means apply the migrations; unreachable means retry. A suspended Neon
// branch makes the second the likely one, and it says nothing about the schema.
main().catch((error: unknown) => {
  const reachable = !(
    error instanceof Error &&
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|terminating connection|Connection terminated/i.test(
      error.message,
    )
  );

  console.error(
    reachable
      ? "Migration check failed:"
      : "Could not reach the database — this says nothing about the schema. " +
          "Retry the deploy; if it persists, check the connection string and that " +
          "the branch is awake.",
    error,
  );

  process.exitCode = 1;
});
