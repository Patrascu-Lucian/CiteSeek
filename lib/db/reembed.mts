/**
 * Which stored vectors the configured embedding model did not write, and the
 * way back: `pnpm db:reembed` reports, `--apply --demo` or
 * `--apply --workspace=<id>` re-embeds one scope (ADR 062).
 *
 * A mismatch is either a wrong configuration or stale data, and only the
 * operator knows which, so nothing is rewritten unless asked. Like the seed, it
 * records no usage.
 */
import postgres from "postgres";

// Explicit .ts extensions: type stripping does not rewrite specifiers.
import {
  type EmbeddedRow,
  outcomeLine,
  parseReembedArgs,
  planReembed,
  readingLine,
  summarizeReembed,
} from "./reembed-plan.ts";
import {
  assertEmbedderWasChosen,
  assertHostWasChosen,
  targetDatabase,
} from "./script-target.ts";

const target = targetDatabase("REEMBED_HOST");
const args = parseReembedArgs(process.argv.slice(2));

// Dynamic for the seed's reason: `lib/db/index.ts` needs DATABASE_URL first.
const { embeddingModelFor, resolveEmbeddingsProvider } =
  await import("../ai/provider.ts");
const { reembedFromOtherModels } = await import("../rag/ingest.ts");

type Sql = ReturnType<typeof postgres>;

// Across every workspace, like `scripts/usage-report.mts`: an operator's read,
// kept here rather than as an unscoped helper in `lib/`.
function embeddedRows(sql: Sql, workspaceId?: string) {
  return sql<EmbeddedRow[]>`
    select w.id as "workspaceId", w.is_demo as "isDemo",
           d.id as "documentId", d.filename, d.status::text as status,
           c.embedding_model as model, count(*)::int as chunks
    from chunks c
    join documents d on d.id = c.document_id
    join workspaces w on w.id = d.workspace_id
    where c.embedding is not null
      ${workspaceId === undefined ? sql`` : sql`and w.id = ${workspaceId}`}
    group by w.id, w.is_demo, d.id, d.filename, d.status, c.embedding_model
    order by w.is_demo desc, w.id, d.filename, c.embedding_model nulls first`;
}

async function scopeWorkspace(sql: Sql): Promise<string> {
  if (!args.apply) throw new Error("No scope without --apply.");

  if ("demo" in args.scope) {
    const [demo] = await sql<{ id: string }[]>`
      select id from workspaces where is_demo limit 1`;
    if (!demo) throw new Error("There is no demo workspace. `pnpm db:seed`.");
    return demo.id;
  }

  const [found] = await sql<{ id: string }[]>`
    select id from workspaces where id = ${args.scope.workspaceId}`;
  if (!found) throw new Error(`No workspace ${args.scope.workspaceId}.`);
  return found.id;
}

async function main() {
  const provider = resolveEmbeddingsProvider();
  const configured = embeddingModelFor(provider);

  // Named first: the two things that can be wrong.
  console.log(
    readingLine(target.hostname, configured, target.exported.provider),
  );

  assertHostWasChosen({
    hostname: target.hostname,
    named: target.exported.host,
    variable: "REEMBED_HOST",
    verb: "re-embed",
  });
  if (args.apply) {
    assertEmbedderWasChosen({
      resolved: provider,
      exported: target.exported.provider,
      hostname: target.hostname,
      verb: "re-embed",
    });
  }

  // A single connection, not the pooled singleton: this must exit.
  const sql = postgres(target.connectionString, { max: 1 });

  try {
    const plan = planReembed(await embeddedRows(sql), configured);
    for (const line of plan.lines) console.log(line);
    if (!args.apply) return;

    const workspaceId = await scopeWorkspace(sql);
    const inScope = plan.affected.filter(
      (document) => document.workspaceId === workspaceId,
    );
    console.log(
      `Re-embedding ${String(inScope.length)} document(s) in ${workspaceId} with ${configured}.`,
    );

    for (const document of inScope) {
      const outcome = await reembedFromOtherModels(
        workspaceId,
        document.documentId,
      );
      console.log(outcomeLine(document, outcome));
      // The next document would meet the same failing embedder.
      if (outcome.error !== null) break;
    }

    const summary = summarizeReembed(
      await embeddedRows(sql, workspaceId),
      inScope.map((document) => document.documentId),
      configured,
    );
    console.log(summary.line);
    process.exitCode = summary.exitCode;
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("Re-embed failed:", error);
  process.exitCode = 1;
});
