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

/** The seed's rule since 1.10.1: success only when every document in scope ends
 * `ready`, with every vector the configured model's. */
export function reembedExitCode(
  after: readonly EmbeddedRow[],
  documentIds: readonly string[],
  configured: string,
): 0 | 1 {
  const repaired = documentIds.every((id) => {
    const rows = after.filter((row) => row.documentId === id);
    return (
      rows.length > 0 &&
      rows.every((row) => row.status === "ready" && row.model === configured)
    );
  });

  return repaired ? 0 : 1;
}
