/**
 * Fails the build when the database is behind the repo's migrations. Wired into
 * Vercel's build command.
 *
 * Migration 0001 was applied to the development branch only, and production
 * returned 500s with no body on upload while the documents list kept working —
 * it selects columns explicitly, the insert did not.
 *
 * **It checks; it does not migrate.** Migrating from a build step would let a
 * *preview* build mutate whichever database Preview points at; failing at startup
 * would take the app down on drift. Failing the build keeps the previous version
 * serving and turns "I forgot to migrate" into a red deploy.
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

function targetHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "an unparseable DATABASE_URL";
  }
}

async function main() {
  const journal = JSON.parse(await readFile(JOURNAL_PATH, "utf8")) as Journal;
  const expected = journal.entries.map((entry) => entry.tag);

  console.log(
    `Checking ${targetHost(connectionString!)} against ${expected.length} migration(s).`,
  );

  const client = postgres(connectionString!, { max: 1 });

  try {
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

main().catch((error: unknown) => {
  console.error("Migration check failed:", error);
  process.exitCode = 1;
});
