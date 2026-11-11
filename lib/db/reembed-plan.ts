/**
 * Split out of `reembed.mts`, as `seed-plan.ts` is out of the seed: the decisions
 * are testable without a database, and the script keeps the I/O.
 */
import { isUuid } from "./uuid.ts";

/** The chunks of one document that one model embedded. `model` is null for a
 * vector stored before its model was recorded. */
export type EmbeddedRow = {
  workspaceId: string;
  isDemo: boolean;
  documentId: string;
  filename: string;
  status: string;
  model: string | null;
  chunks: number;
};

export type ReembedArgs =
  | { apply: false }
  | { apply: true; scope: { demo: true } | { workspaceId: string } };

/** The report needs no arguments; `--apply` rewrites vectors, so it needs one
 * scope named on the command line. */
export function parseReembedArgs(args: readonly string[]): ReembedArgs {
  let apply = false;
  let demo = false;
  let workspaceId: string | undefined;

  for (const arg of args) {
    if (arg === "--apply") apply = true;
    else if (arg === "--demo") demo = true;
    else if (arg.startsWith("--workspace="))
      workspaceId = arg.slice("--workspace=".length);
    else
      throw new Error(
        `Unknown argument "${arg}". Expected --apply with --demo or --workspace=<id>.`,
      );
  }

  if (demo && workspaceId !== undefined)
    throw new Error("Name one scope: --demo or --workspace=<id>, not both.");
  if (workspaceId !== undefined && !isUuid(workspaceId))
    throw new Error(
      `--workspace expects a workspace id, got "${workspaceId}".`,
    );

  if (!apply) {
    if (demo || workspaceId !== undefined)
      throw new Error(
        "A scope only applies with --apply; without it this prints the report.",
      );
    return { apply: false };
  }

  if (demo) return { apply: true, scope: { demo: true } };
  if (workspaceId !== undefined) return { apply: true, scope: { workspaceId } };
  throw new Error(
    "--apply rewrites vectors, so it needs a scope: --demo or --workspace=<id>.",
  );
}

export type AffectedDocument = {
  workspaceId: string;
  documentId: string;
  filename: string;
  /** Vectors the configured model did not write, unlabeled ones included. */
  foreign: number;
};

/** Every document holding a vector the configured model did not write, and the
 * report that names them. Documents, not workspaces: one can be split. */
export function planReembed(
  rows: readonly EmbeddedRow[],
  configured: string,
): { affected: AffectedDocument[]; lines: string[] } {
  const documents = new Map<
    string,
    { row: EmbeddedRow; foreign: number; models: string[] }
  >();

  for (const row of rows) {
    const document = documents.get(row.documentId) ?? {
      row,
      foreign: 0,
      models: [],
    };
    if (row.model !== configured) document.foreign += row.chunks;
    document.models.push(`${row.model ?? "unlabeled"} ${String(row.chunks)}`);
    documents.set(row.documentId, document);
  }

  const affected = [...documents.values()].filter(
    (document) => document.foreign > 0,
  );

  const lines = [`Configured model: ${configured}.`];
  if (documents.size === 0) {
    lines.push("No embedded vectors at all.");
  } else if (affected.length === 0) {
    lines.push(
      `Nothing to re-embed: every vector in ${String(documents.size)} document(s) is ${configured}'s.`,
    );
  } else {
    lines.push(
      `Vectors ${configured} did not write, in ${String(affected.length)} of ${String(documents.size)} document(s):`,
    );
    for (const { row, models } of affected) {
      const demo = row.isDemo ? " (demo)" : "";
      lines.push(
        `  workspace ${row.workspaceId}${demo}  ${row.filename}  ${row.status}  ${models.join(", ")}`,
      );
    }
    lines.push(
      "Re-embed one scope at a time: --apply --demo, or --apply --workspace=<id>.",
    );
  }

  return {
    affected: affected.map(({ row, foreign }) => ({
      workspaceId: row.workspaceId,
      documentId: row.documentId,
      filename: row.filename,
      foreign,
    })),
    lines,
  };
}

/** "Configured" is this shell's answer. Unexported, it came from `.env.local` or
 * the default, which is how a laptop reads production as entirely foreign. */
export function readingLine(
  hostname: string | null,
  configured: string,
  exported: string | undefined,
): string {
  const reading = `Reading ${hostname ?? "an unparseable DATABASE_URL"}, configured for ${configured}`;
  return exported?.trim()
    ? `${reading}.`
    : `${reading} by .env.local or the default. A deployment may differ: export EMBEDDINGS_PROVIDER to read as it does.`;
}

/** From the result, not the intent: the line used to say "re-embedded" whether
 * or not anything was. */
export function outcomeLine(
  document: Pick<AffectedDocument, "filename" | "foreign">,
  outcome: { reembedded: number; error: string | null },
): string {
  const done = `  ${document.filename}: ${String(outcome.reembedded)} of ${String(document.foreign)} re-embedded`;
  return outcome.error === null
    ? `${done}.`
    : `${done}, then: ${outcome.error}`;
}

/** Success is every vector in scope being the configured model's. Status is not
 * judged: re-embedding in place never changes it, and retrieval does not read it. */
export function summarizeReembed(
  after: readonly EmbeddedRow[],
  documentIds: readonly string[],
  configured: string,
): { exitCode: 0 | 1; line: string } {
  if (documentIds.length === 0)
    return { exitCode: 0, line: "Nothing in this scope to re-embed." };

  const left = after.filter(
    (row) => documentIds.includes(row.documentId) && row.model !== configured,
  );
  const remaining = left.reduce((sum, row) => sum + row.chunks, 0);

  if (remaining === 0)
    return {
      exitCode: 0,
      line: `Every vector in ${String(documentIds.length)} document(s) is now ${configured}'s.`,
    };

  const documents = new Set(left.map((row) => row.documentId)).size;
  return {
    exitCode: 1,
    line: `${String(remaining)} vector(s) in ${String(documents)} document(s) are still not ${configured}'s. Run the same command again to continue.`,
  };
}
