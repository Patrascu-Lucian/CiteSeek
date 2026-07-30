/**
 * Refuses to build when the database is behind the migrations in the repo.
 *
 * Run with `pnpm db:check`, and wired into Vercel's build command so a deploy
 * fails rather than shipping code against a schema that cannot serve it.
 *
 * This has gone wrong twice. Migration 0001 added `content_text` and
 * `page_spans`, was applied to the development branch only, and production
 * returned 500s with no body on upload — while the documents list kept working,
 * because it selects columns explicitly and the insert did not. Nothing in the
 * pipeline connected "a migration exists" to "the database has it".
 *
 * **It checks; it does not migrate.** That distinction is the whole design:
 *
 * - Running migrations in the build would mutate a database from a build step,
 *   and a *preview* build would mutate whichever database the Preview
 *   environment points at. Getting that mapping wrong once is a preview
 *   deployment altering production.
 * - Failing at startup instead would take the whole app down on drift, and a
 *   demo that is down is the failure this project most wants to avoid.
 *
 * Failing the build keeps the previously deployed version serving, costs
 * nothing when everything is in order, and turns "I forgot to migrate" into a
 * red deploy instead of a 500 on the first request that touches a new column.
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
    // Drizzle records one row per applied migration. The table does not exist
    // at all on a database that has never been migrated, which is itself the
    // answer rather than an error worth surfacing raw.
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
