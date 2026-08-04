/**
 * Measures retrieval against `eval/golden-set.ts`. By hand, never in CI: it needs
 * a real provider, and the fake one would report word overlap as if it were
 * retrieval quality.
 *
 * The floor is **disabled** here so one pass scores every threshold — sweeping it
 * live would re-embed the same questions and measure provider variance instead.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";
import { GOLDEN_SET } from "../eval/golden-set.ts";
import {
  mean,
  scoreQuery,
  sweepFloor,
  type FloorCase,
  type Retrieved,
  type Span,
} from "../lib/rag/eval-metrics.ts";

const exportedProvider = process.env.EMBEDDINGS_PROVIDER;
const confirmedHost = process.env.EVAL_HOST;

loadLocalEnv();

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
process.env.DATABASE_URL = connectionString;

const hostname = new URL(connectionString).hostname;
const LOCAL = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal)$/;

/* The same argument as the seed's host guard, and it should collapse into one
   helper once that lands on main: this writes documents and spends embedding
   quota, so it must not reach a database nobody named. */
const named = confirmedHost !== undefined && hostname.includes(confirmedHost);

if (!LOCAL.test(hostname) && !named) {
  throw new Error(
    `Refusing to run against ${hostname}. Name it: EVAL_HOST=${hostname.split(".")[0]}`,
  );
}

if (exportedProvider?.trim().toLowerCase() !== "google") {
  throw new Error(
    "Export EMBEDDINGS_PROVIDER=google. The fake embedder measures word overlap,\n" +
      "not retrieval, and a number from it would be worse than no number.",
  );
}

const { db } = await import("../lib/db/index.ts");
const { workspaces } = await import("../lib/db/schema.ts");
const { createQueuedDocument, findDocumentInWorkspace } =
  await import("../lib/documents/queries.ts");
const { processDocument } = await import("../lib/rag/ingest.ts");
const { retrieveChunks } = await import("../lib/rag/retrieve.ts");
const { RETRIEVAL_LIMIT } = await import("../lib/rag/retrieval-config.ts");

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "eval",
  "fixtures",
);
const FILES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

/** Wide, and low, because the first run showed 0.6 refusing nothing at all. */
const THRESHOLDS = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8];
const K_VALUES = [1, 3, RETRIEVAL_LIMIT];

console.log(`Evaluating against ${hostname}\n`);

const [workspace] = await db
  .insert(workspaces)
  .values({ name: `eval ${new Date().toISOString()}`, ownerId: null })
  .returning({ id: workspaces.id });

const workspaceId = workspace!.id;
const textByFile = new Map<string, string>();
const idByFile = new Map<string, string>();

try {
  for (const file of FILES) {
    const bytes = new Uint8Array(await readFile(join(FIXTURES, file)));
    const document = await createQueuedDocument(workspaceId, {
      filename: file,
      mimeType: "text/markdown",
      sizeBytes: bytes.length,
    });

    await processDocument(workspaceId, document.id, bytes, "text/markdown");

    const stored = await findDocumentInWorkspace(workspaceId, document.id);
    // Offsets index the *stored* text, which normalization has already rewritten.
    textByFile.set(file, stored?.contentText ?? "");
    idByFile.set(file, document.id);
    console.log(`  ingested ${file}`);
  }

  const cases: FloorCase[] = [];
  const scores = new Map<
    number,
    { recall: number[]; precision: number[]; rr: number[] }
  >(K_VALUES.map((k) => [k, { recall: [], precision: [], rr: [] }]));

  console.log(`\nRunning ${String(GOLDEN_SET.length)} questions…`);

  for (const one of GOLDEN_SET) {
    const expected: Span[] = one.expect.map(({ file, quote }) => {
      const text = textByFile.get(file) ?? "";
      const charStart = text.indexOf(quote);

      // A quote that no longer appears is a broken golden set, not a miss. Left
      // unchecked it would score zero and read as a retrieval regression.
      if (charStart === -1) {
        throw new Error(`Quote not found in ${file}: "${quote}"`);
      }

      return {
        documentId: idByFile.get(file)!,
        charStart,
        charEnd: charStart + quote.length,
      };
    });

    const { chunks } = await retrieveChunks(workspaceId, one.question, {
      limit: 20,
      maxDistance: Number.POSITIVE_INFINITY,
    });

    const retrieved: Retrieved[] = chunks.map((chunk) => ({
      documentId: chunk.documentId,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      distance: chunk.distance,
    }));

    cases.push({ answerable: expected.length > 0, retrieved });

    for (const k of K_VALUES) {
      const score = scoreQuery(expected, retrieved, k);
      const bucket = scores.get(k)!;
      // Unanswerable questions have no recall to average; including their
      // vacuous 1 would report a corpus-wide recall nobody measured.
      if (expected.length > 0) {
        bucket.recall.push(score.recall);
        bucket.precision.push(score.precision);
        bucket.rr.push(score.reciprocalRank);
      }
    }
  }

  const answerable = cases.filter((one) => one.answerable).length;

  const rankTable = K_VALUES.map((k) => {
    const bucket = scores.get(k)!;
    return {
      k,
      recall: mean(bucket.recall),
      precision: mean(bucket.precision),
      mrr: mean(bucket.rr),
    };
  });

  const floorTable = sweepFloor(cases, THRESHOLDS);

  const report = [
    "# Retrieval evaluation",
    "",
    `Run ${new Date().toISOString().slice(0, 10)} against \`gemini-embedding-001\`, `,
    `${String(FILES.length)} documents, ${String(GOLDEN_SET.length)} questions `,
    `(${String(answerable)} answerable, ${String(GOLDEN_SET.length - answerable)} not).`,
    "",
    "Questions are written against what the documents mean rather than from their",
    "headings, and expected passages are recorded as quotes so re-chunking moves",
    "the mapping instead of invalidating it.",
    "",
    "## Ranking, over the answerable questions",
    "",
    "| k | recall | precision | MRR |",
    "| - | ------ | --------- | --- |",
    ...rankTable.map(
      (row) =>
        `| ${String(row.k)} | ${row.recall.toFixed(2)} | ${row.precision.toFixed(2)} | ${row.mrr.toFixed(2)} |`,
    ),
    "",
    "## The relevance floor",
    "",
    "The two errors move in opposite directions, so no threshold minimizes both.",
    "A false refusal is a question the corpus could answer and did not; a false",
    "accept is an ungrounded question reaching the model.",
    "",
    "### Closest chunk per question",
    "",
    "Where a floor could ever sit. The two ranges overlap, which is the finding:",
    "no single distance separates them cleanly.",
    "",
    "| | min | median | max |",
    "| - | --- | ------ | --- |",
    ...(["answerable", "unanswerable"] as const).map((label) => {
      const wanted = label === "answerable";
      const best = cases
        .filter((one) => one.answerable === wanted)
        .map((one) => one.retrieved[0]?.distance ?? 1)
        .sort((a, b) => a - b);
      const median = best[Math.floor(best.length / 2)] ?? 0;
      return `| ${label} | ${(best[0] ?? 0).toFixed(3)} | ${median.toFixed(3)} | ${(best.at(-1) ?? 0).toFixed(3)} |`;
    }),
    "",
    "| max distance | false refusals | false accepts |",
    "| ------------ | -------------- | ------------- |",
    ...floorTable.map(
      (row) =>
        `| ${row.maxDistance.toFixed(2)} | ${String(row.falseRefusals)}/${String(row.answerable)} | ${String(row.falseAccepts)}/${String(row.unanswerable)} |`,
    ),
    "",
  ].join("\n");

  /* The distances, so re-sweeping is arithmetic rather than another 45 embedding
     calls. The first run asked a threshold question the sweep could not answer,
     and re-running to widen it measured the provider again for no reason. */
  await writeFile(
    join(FIXTURES, "..", "distances.json"),
    JSON.stringify(
      GOLDEN_SET.map((one, index) => ({
        question: one.question,
        answerable: cases[index]!.answerable,
        best: cases[index]!.retrieved[0]?.distance ?? null,
      })),
      null,
      2,
    ),
  );

  const output = join(FIXTURES, "..", "report.md");
  await writeFile(output, report);

  console.log(`\n${report}`);
  console.log(`Written to ${output}`);
} finally {
  // Cascades to documents, chunks and embeddings. The harness leaves nothing.
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  console.log("\nScratch workspace removed.");
}
