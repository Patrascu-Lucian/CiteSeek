/**
 * Seeds the demo workspace that guest mode reads from.
 *
 * Run with `pnpm db:seed`. Executed directly by Node -- Node 24 strips TypeScript
 * types natively, so this needs no tsx/ts-node in the dependency tree.
 *
 * Idempotent by design: it is run locally, in CI, and against preview databases,
 * so a second run must be a no-op rather than an error or a duplicate.
 */
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

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export const DEMO_WORKSPACE_NAME = "CiteSeek Demo";

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
      console.log(
        `Demo workspace already present (${existing.id}) — nothing to do.`,
      );
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

    console.log(`Created demo workspace ${created?.id}`);
    console.log(
      "No documents seeded yet — document ingestion arrives in Milestone 1.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
