/**
 * Seeds the demo workspace guest mode reads from. `pnpm db:seed`.
 *
 * Runs through tsx rather than bare Node: Node resolves specifiers as written and
 * cannot follow the `@/` alias into app modules.
 *
 * A second run must be a no-op — CI asserts it by seeding twice.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Explicit .ts extensions: type stripping does not rewrite specifiers.
import * as schema from "./schema.ts";
import {
  assertEmbedderWasChosen,
  assertHostWasChosen,
  targetDatabase,
} from "./script-target.ts";
import { planFixtureSeed, seedExitCode } from "./seed-plan.ts";
import { workspaces } from "./schema.ts";

const target = targetDatabase("SEED_HOST");

// Dynamic because `lib/db/index.ts` throws at module load on a missing
// DATABASE_URL, and ESM evaluates static imports before this file's first
// statement — before `targetDatabase` has set it.
const { createQueuedDocument, deleteDocumentInWorkspace, listDocuments } =
  await import("../documents/queries.ts");
const { processDocument } = await import("../rag/ingest.ts");
const { resolveEmbeddingsProvider } = await import("../ai/provider.ts");

export const DEMO_WORKSPACE_NAME = "Demo workspace";

/** Fictional, recorded *here* not inside the document: the first draft said it was
 * a demo fixture, which put text about the assistant into its own corpus and
 * became the nearest passage for any meta-question. */
export const FIXTURE_FILENAME = "northwind-remote-work-handbook.pdf";
const FIXTURE_MIME = "application/pdf";
const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  FIXTURE_FILENAME,
);

/**
 * Filenames this fixture has used before, so an older database converges instead
 * of keeping both. Markdown has no pages, so every demo citation read as a
 * passage with no location.
 */
const SUPERSEDED_FILENAMES = ["northwind-remote-work-handbook.md"];

/** Through `processDocument` rather than inserting rows: hand-built chunks could
 * drift from what the pipeline produces and hide a real break. */
async function seedFixtureDocument(workspaceId: string) {
  const existing = await listDocuments(workspaceId);

  // The decision lives in `seed-plan.ts`, where it can be tested without a
  // database. This function keeps the I/O.
  const plan = planFixtureSeed({
    existing,
    filename: FIXTURE_FILENAME,
    supersededFilenames: SUPERSEDED_FILENAMES,
  });

  console.log(`Demo workspace: ${plan.reason}.`);
  if (!plan.create) return;

  for (const id of plan.remove) {
    // Chunks and embeddings go with it through ON DELETE CASCADE, so nothing is
    // left pointing at text that is no longer the demo's.
    await deleteDocumentInWorkspace(workspaceId, id);
  }

  const bytes = new Uint8Array(await readFile(FIXTURE_PATH));

  // Named, because nothing in the output naming the embedder is what made the
  // production failure invisible.
  console.log(`Embedding with the ${resolveEmbeddingsProvider()} provider.`);

  const document = await createQueuedDocument(workspaceId, {
    filename: FIXTURE_FILENAME,
    mimeType: FIXTURE_MIME,
    sizeBytes: bytes.length,
  });

  // Awaited: a script must not exit with the work half done.
  await processDocument(workspaceId, document.id, bytes, FIXTURE_MIME);

  const seeded = (await listDocuments(workspaceId)).find(
    ({ id }) => id === document.id,
  );
  console.log(
    `Seeded ${FIXTURE_FILENAME} — ${seeded?.status}, ${seeded?.embeddedChunkCount ?? 0} passages embedded.`,
  );
  if (seeded?.error) console.error(`Ingestion error: ${seeded.error}`);

  process.exitCode = seedExitCode(seeded?.status);
}

async function main() {
  // Named before anything else, since it is the only field that can be wrong.
  console.log(`Seeding ${target.hostname ?? "an unparseable DATABASE_URL"}`);

  // Before anything is written, and before a connection is opened.
  assertHostWasChosen({
    hostname: target.hostname,
    named: target.exported.host,
    variable: "SEED_HOST",
    verb: "seed",
  });
  assertEmbedderWasChosen({
    resolved: resolveEmbeddingsProvider(),
    exported: target.exported.provider,
    hostname: target.hostname,
    verb: "seed",
  });

  // A single connection, not the pooled singleton: this must exit.
  const client = postgres(target.connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const [existing] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.isDemo, true))
      .limit(1);

    if (existing) {
      console.log(`Demo workspace already present (${existing.id}).`);

      // Converges rather than freezing on first write: the name is only applied
      // on insert, so renaming the constant alone would leave every database
      // that has ever been seeded on the old one. Same trap the fixture filename
      // hit.
      if (existing.name !== DEMO_WORKSPACE_NAME) {
        await db
          .update(workspaces)
          .set({ name: DEMO_WORKSPACE_NAME })
          .where(eq(workspaces.id, existing.id));
        console.log(`Renamed ${existing.name} to ${DEMO_WORKSPACE_NAME}.`);
      }

      // The workspace may predate the fixture.
      await seedFixtureDocument(existing.id);
      return;
    }

    const [created] = await db
      .insert(workspaces)
      .values({
        name: DEMO_WORKSPACE_NAME,
        // Owned by no one. The partial unique index on `is_demo` guarantees there
        // is never a second.
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
