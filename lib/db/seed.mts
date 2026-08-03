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
import { loadLocalEnv } from "../env/load-local-env.ts";
import * as schema from "./schema.ts";
import { planFixtureSeed } from "./seed-plan.ts";
import { workspaces } from "./schema.ts";

// Captured before `.env.local` applies, so the guard can tell a deliberate export
// from one the file supplied.
const exportedProvider = process.env.EMBEDDINGS_PROVIDER;

loadLocalEnv();

// Unpooled, like migrations. Falls back where no pooler exists (Docker, CI).
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

/**
 * One connection target for the whole script. Two paths reach the database — this
 * client, and `lib/` helpers whose singleton reads `DATABASE_URL` only — so
 * `DATABASE_URL_UNPOOLED=<production>` used to split them and exit 0 having
 * seeded nothing. Must precede the imports below, hence dynamic.
 */
process.env.DATABASE_URL = connectionString;

// Dynamic because `lib/db/index.ts` throws at module load on a missing
// DATABASE_URL, and ESM evaluates static imports before this file's first
// statement — before `loadLocalEnv()` has run.
const { createQueuedDocument, deleteDocumentInWorkspace, listDocuments } =
  await import("../documents/queries.ts");
const { processDocument } = await import("../rag/ingest.ts");
const { resolveEmbeddingsProvider } = await import("../ai/provider.ts");

/**
 * Vectors from two models share no geometry, so a fake-seeded production answers
 * "nothing relevant" to everything while still reporting rows written. Has
 * happened once.
 *
 * The test is **provenance, not value**: an exported fake is a decision, one
 * `.env.local` supplied is an accident — which is why the escape hatch cannot
 * live there. Local hosts exempt.
 */
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);

function assertEmbedderWasChosen(url: string): void {
  if (resolveEmbeddingsProvider() !== "fake") return;
  if (exportedProvider?.trim().toLowerCase() === "fake") return;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // An unparseable URL is the connection's problem to report, not this guard's.
    return;
  }

  if (LOCAL_HOSTS.has(hostname)) return;

  throw new Error(
    [
      `Refusing to seed ${hostname} with the fake embedder.`,
      "",
      "EMBEDDINGS_PROVIDER resolves to 'fake' from .env.local rather than your",
      "shell, and fake vectors are unretrievable by the real model. Say which:",
      "",
      "  export EMBEDDINGS_PROVIDER=google   # real embeddings (production)",
      "  export EMBEDDINGS_PROVIDER=fake     # deliberately fake (a scratch branch)",
    ].join("\n"),
  );
}

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

  const [seeded] = await listDocuments(workspaceId);
  console.log(
    `Seeded ${FIXTURE_FILENAME} — ${seeded?.status}, ${seeded?.embeddedChunkCount ?? 0} passages embedded.`,
  );
}

/** The host, for the log line. Never the credentials. */
function targetHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "an unparseable DATABASE_URL";
  }
}

async function main() {
  // Named first: `.env.local` supplies DATABASE_URL to any shell that did not
  // export one, so a seed aimed at production lands on the dev branch and reports
  // success. Neon branches share row ids, so the host is the only tell.
  console.log(`Seeding ${targetHost(connectionString!)}`);

  // Before anything is written, and before a connection is opened.
  assertEmbedderWasChosen(connectionString!);

  // A single connection, not the pooled singleton: this must exit.
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
