/**
 * Seeds the demo workspace that guest mode reads from.
 *
 * Run with `pnpm db:seed`, through tsx.
 *
 * It used to run under bare Node, which strips TypeScript types natively and
 * needed no loader. That stopped working when seeding began driving the real
 * ingestion pipeline: Node resolves module specifiers exactly as written and has
 * no idea what the `@/` alias in tsconfig means, so every app module it reaches
 * fails to resolve. tsx reads the alias table.
 *
 * Idempotent by design: it is run locally, in CI, and against preview databases,
 * so a second run must be a no-op rather than an error or a duplicate.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Explicit .ts extensions: Node's native type stripping does not rewrite module
// specifiers, so it resolves them exactly as written. Enabled for the whole
// project by `allowImportingTsExtensions` in tsconfig.json.
import { loadLocalEnv } from "../env/load-local-env.ts";
import * as schema from "./schema.ts";
import { workspaces } from "./schema.ts";

loadLocalEnv();

// Imported *after* the env is loaded, and dynamically for that reason.
//
// `lib/db/index.ts` reads DATABASE_URL and throws at module load if it is
// missing. ESM evaluates every static import before the first statement of this
// file runs, so a static import here would reach that check before
// `loadLocalEnv()` had a chance to put the variable on `process.env` — the
// script would fail with "DATABASE_URL is not set" on a machine where it is very
// much set. The modules above are safe to import statically because none of them
// touch the environment at load time.
const { createQueuedDocument, listDocuments } =
  await import("../documents/queries.ts");
const { processDocument } = await import("../rag/ingest.ts");

// Seeding writes schema-adjacent data and runs as a one-shot script, so it uses
// the unpooled connection for the same reason migrations do. Falls back to
// DATABASE_URL where no pooler exists (local Docker, CI).
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export const DEMO_WORKSPACE_NAME = "CiteSeek Demo";

/** Committed to the repo so the demo is reproducible from a clean database. */
export const FIXTURE_FILENAME = "northwind-remote-work-handbook.md";
const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "citeseek-handbook.md",
);

/**
 * Puts one document in the demo workspace, through the real ingestion pipeline.
 *
 * Guests can only read the demo, so without this there is nothing for a visitor
 * — or an end-to-end test — to ask about, and every question returns the same
 * refusal. Running it through `processDocument` rather than inserting rows
 * directly means the seeded chunks and offsets are produced exactly as an upload
 * would produce them; a hand-built fixture could drift from what the pipeline
 * actually does and hide a real break.
 *
 * Which embedder runs is decided by `EMBEDDINGS_PROVIDER`, like everywhere else:
 * the real one where a key is configured, the deterministic fake in CI.
 */
async function seedFixtureDocument(workspaceId: string) {
  const existing = await listDocuments(workspaceId);

  if (existing.length > 0) {
    console.log(
      `Demo workspace already has ${existing.length} document(s) — leaving them alone.`,
    );
    return;
  }

  const bytes = new Uint8Array(await readFile(FIXTURE_PATH));

  const document = await createQueuedDocument(workspaceId, {
    filename: FIXTURE_FILENAME,
    mimeType: "text/markdown",
    sizeBytes: bytes.length,
  });

  // Awaited rather than backgrounded: this is a script, and it must not exit
  // with the work half done.
  await processDocument(workspaceId, document.id, bytes, "text/markdown");

  const [seeded] = await listDocuments(workspaceId);
  console.log(
    `Seeded ${FIXTURE_FILENAME} — ${seeded?.status}, ${seeded?.embeddedChunkCount ?? 0} passages embedded.`,
  );
}

async function main() {
  // A dedicated single connection rather than the app's pooled singleton: this is
  // a one-shot script and must exit, not hold a pool open.
  const client = postgres(connectionString!, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const [existing] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.isDemo, true))
      .limit(1);

    if (existing) {
      console.log(`Demo workspace already present (${existing.id}).`);
      // Still checked: the workspace may predate the fixture, as it does on
      // every database seeded before this milestone.
      await seedFixtureDocument(existing.id);
      return;
    }

    const [created] = await db
      .insert(workspaces)
      .values({
        name: DEMO_WORKSPACE_NAME,
        // Owned by no one. Guests read it; nothing writes to it. The partial
        // unique index on is_demo guarantees there is never a second one.
        ownerId: null,
        isDemo: true,
      })
      .returning({ id: workspaces.id });

    console.log(`Created demo workspace ${created!.id}`);
    await seedFixtureDocument(created!.id);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
