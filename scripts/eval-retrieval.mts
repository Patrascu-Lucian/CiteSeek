/** Retrieval quality against `eval/golden-set.ts`. By hand, never in CI: the fake
 * embedder would report word overlap as if it were retrieval. The floor is
 * **disabled**, so one pass scores every threshold and every fusion weight. */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";
import {
  FOLLOW_UP_SET,
  GOLDEN_SET,
  type Expectation,
} from "../eval/golden-set.ts";
import {
  mean,
  scoreQuery,
  sweepFloor,
  type FloorCase,
  type Retrieved,
  type Span,
} from "../lib/rag/eval-metrics.ts";

const exportedProvider = process.env.EMBEDDINGS_PROVIDER;
// Read before `loadLocalEnv`, like the one above: `.env.local` says `fake` for
// ordinary development, and a file must not be what decides to spend money.
const exportedChatProvider = process.env.CHAT_PROVIDER;
const confirmedHost = process.env.EVAL_HOST;

loadLocalEnv();

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
process.env.DATABASE_URL = connectionString;

const hostname = new URL(connectionString).hostname;
const LOCAL = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal)$/;

/* The seed's guard, duplicated: this writes documents and spends quota, so it
   must not reach a database nobody named. Worth collapsing into one helper. */
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

// The same argument one model over: a fake chat model scores nothing about the
// shipped prompt.
if (exportedChatProvider?.trim().toLowerCase() !== "google") {
  throw new Error(
    "Export CHAT_PROVIDER=google. The rewrite column calls the real model, and\n" +
      "the fake one returns a fixture that would score nothing about the prompt.",
  );
}

const { db } = await import("../lib/db/index.ts");
const { workspaces } = await import("../lib/db/schema.ts");
const { createQueuedDocument, findDocumentInWorkspace } =
  await import("../lib/documents/queries.ts");
const { processDocument } = await import("../lib/rag/ingest.ts");
const { retrieveChunks } = await import("../lib/rag/retrieve.ts");
// Deferred like the rest: `lib/db/index.ts` throws at load without `DATABASE_URL`,
// which the guards set. Not a provider concern — `getChatModel` reads env on call.
const { rewriteQuestion } = await import("../lib/ai/rewrite.ts");
const { retrieveLexical } = await import("../lib/rag/lexical.ts");
const { fuse } = await import("../lib/rag/fusion.ts");
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
/** Wider than any k in the sweep, so the tail of a ranking is never truncated
 * before it is scored. */
const SCORING_LIMIT = 20;
const FOLLOW_UP_K = 3;

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

  const spansFor = (expect: readonly Expectation[]): Span[] =>
    expect.map(({ file, quote }) => {
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

  // Resolved before the first question: the throw above, reached 51 paid
  // questions in, discards the whole run and writes no report.
  const goldenSpans = GOLDEN_SET.map((one) => spansFor(one.expect));
  const followUpSpans = FOLLOW_UP_SET.map((one) => spansFor(one.expect));

  /* The lexical list's weight, against a vector weight fixed at 1. Zero is
     vector alone, so the baseline sits on the same sweep as every blend. */
  const LEXICAL_WEIGHTS = [0, 0.25, 0.5, 0.75, 1];
  const STRATEGIES = [
    "lexical",
    ...LEXICAL_WEIGHTS.map((w) => "hybrid " + String(w)),
  ];
  type Strategy = string;

  const cases: FloorCase[] = [];
  const scores = new Map<
    string,
    { recall: number[]; precision: number[]; rr: number[] }
  >(
    STRATEGIES.flatMap((s) =>
      K_VALUES.map(
        (k) =>
          [`${s}:${String(k)}`, { recall: [], precision: [], rr: [] }] as const,
      ),
    ),
  );

  console.log(`\nRunning ${String(GOLDEN_SET.length)} questions…`);

  for (const [index, one] of GOLDEN_SET.entries()) {
    const expected = goldenSpans[index]!;

    const { chunks } = await retrieveChunks(workspaceId, one.question, {
      limit: SCORING_LIMIT,
      maxDistance: Number.POSITIVE_INFINITY,
    });
    const lexical = await retrieveLexical(workspaceId, one.question, {
      limit: SCORING_LIMIT,
    });

    const asSpan = (chunk: {
      documentId: string;
      charStart: number;
      charEnd: number;
    }): Retrieved => ({
      documentId: chunk.documentId,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      // Only the vector list carries a distance; the floor is scored from it
      // alone, below, because that is what the route thresholds today.
      distance: 0,
    });

    const retrieved: Retrieved[] = chunks.map((chunk) => ({
      ...asSpan(chunk),
      distance: chunk.distance,
    }));

    // Fusion needs identity and a span, not two different result shapes.
    const asRef = (chunk: {
      id: string;
      documentId: string;
      charStart: number;
      charEnd: number;
    }) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
    });

    const ranked: Record<Strategy, Retrieved[]> = {
      lexical: lexical.map(asSpan),
      ...Object.fromEntries(
        LEXICAL_WEIGHTS.map((weight) => [
          "hybrid " + String(weight),
          fuse(
            { vector: chunks.map(asRef), lexical: lexical.map(asRef) },
            { lexical: weight },
          ).map((one) => asSpan(one.item)),
        ]),
      ),
    };

    cases.push({ answerable: expected.length > 0, retrieved });

    for (const strategy of STRATEGIES) {
      for (const k of K_VALUES) {
        const score = scoreQuery(expected, ranked[strategy] ?? [], k);
        const bucket = scores.get(`${strategy}:${String(k)}`)!;
        // Unanswerable questions have no recall to average; including their
        // vacuous 1 would report a corpus-wide recall nobody measured.
        if (expected.length > 0) {
          bucket.recall.push(score.recall);
          bucket.precision.push(score.precision);
          bucket.rr.push(score.reciprocalRank);
        }
      }
    }
  }

  console.log(
    `\nRunning ${String(FOLLOW_UP_SET.length)} follow-ups: ${String(FOLLOW_UP_SET.length)} rewrites and up to ${String(FOLLOW_UP_SET.length * 3)} retrievals…`,
  );

  let declined = 0;
  const followUps: {
    followUp: string;
    asked: number;
    standalone: number;
    rewritten: number;
    rewrittenText: string | null;
    bestAsked: number | null;
  }[] = [];

  for (const [index, one] of FOLLOW_UP_SET.entries()) {
    const expected = followUpSpans[index]!;

    const scoreOf = async (query: string) => {
      const { chunks } = await retrieveChunks(workspaceId, query, {
        limit: SCORING_LIMIT,
        maxDistance: Number.POSITIVE_INFINITY,
      });

      const retrieved: Retrieved[] = chunks.map((chunk) => ({
        documentId: chunk.documentId,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        distance: chunk.distance,
      }));

      return {
        recall: scoreQuery(expected, retrieved, FOLLOW_UP_K).recall,
        best: retrieved[0]?.distance ?? null,
      };
    };

    // The pair shares nothing, and each half is a metered round trip.
    const [asked, standalone] = await Promise.all([
      scoreOf(one.followUp),
      scoreOf(one.standalone),
    ]);

    /*
      `standalone` is written by hand and measures the ceiling; this measures the
      distance traveled to it. A floor on the shipped behavior rather than a
      description: the golden set holds only the reader's own prior turns, where
      production also has the answers.
    */
    const rewrite = await rewriteQuestion(
      [...one.context, one.followUp].map((text) => ({
        id: crypto.randomUUID(),
        role: "user" as const,
        parts: [{ type: "text" as const, text }],
      })),
      one.followUp,
    );

    // Null is shipped behavior too: `acceptRewrite` rejects a rewrite that gained
    // nothing. Scored as asked, which is what retrieval falls back to.
    const rewritten = rewrite
      ? await scoreOf(rewrite.question)
      : { recall: asked.recall, best: asked.best };

    // `rewriteQuestion` swallows provider errors into the same null: a quota
    // refusal mid-run would print every remaining row as a decline.
    if (!rewrite) declined += 1;

    followUps.push({
      followUp: one.followUp,
      asked: asked.recall,
      standalone: standalone.recall,
      rewritten: rewritten.recall,
      rewrittenText: rewrite?.question ?? null,
      bestAsked: asked.best,
    });
  }

  // A run that declined most of them measured the provider, not the prompt.
  if (declined > FOLLOW_UP_SET.length / 2) {
    throw new Error(
      `${String(declined)} of ${String(FOLLOW_UP_SET.length)} rewrites returned nothing. ` +
        "`rewriteQuestion` swallows provider errors, so this is quota or the network " +
        "as readily as a genuine decline. No report written.",
    );
  }

  const answerable = cases.filter((one) => one.answerable).length;

  const rankTable = STRATEGIES.flatMap((strategy) =>
    K_VALUES.map((k) => {
      const bucket = scores.get(`${strategy}:${String(k)}`)!;
      return {
        strategy,
        k,
        recall: mean(bucket.recall),
        precision: mean(bucket.precision),
        mrr: mean(bucket.rr),
      };
    }),
  );

  const floorTable = sweepFloor(cases, THRESHOLDS);

  const report = [
    "# Retrieval evaluation",
    "",
    `Run ${new Date().toISOString().slice(0, 10)} against \`gemini-embedding-001\`,`,
    `${String(FILES.length)} documents, ${String(GOLDEN_SET.length)} questions`,
    `(${String(answerable)} answerable, ${String(GOLDEN_SET.length - answerable)} not).`,
    "",
    "Questions are written against what the documents mean rather than from their",
    "headings, and expected passages are recorded as quotes so re-chunking moves",
    "the mapping instead of invalidating it.",
    "",
    "## Ranking, over the answerable questions",
    "",
    "Reciprocal rank fusion compares positions rather than scores, because a cosine",
    "distance and a `ts_rank_cd` are not the same kind of number. The weight below is",
    "the lexical list's, against a vector weight of 1 — so **hybrid 0 is vector",
    "alone**, on the same sweep rather than beside it.",
    "",
    "| strategy | k | recall | precision | MRR |",
    "| -------- | - | ------ | --------- | --- |",
    ...rankTable.map(
      (row) =>
        `| ${row.strategy} | ${String(row.k)} | ${row.recall.toFixed(2)} | ${row.precision.toFixed(2)} | ${row.mrr.toFixed(2)} |`,
    ),
    "",
    "## Follow-up questions",
    "",
    "Only the last message is embedded, so a follow-up carries nothing to retrieve",
    "against. Each row is one information need asked three ways — as typed, written",
    "by hand to stand alone, and put through the shipped rewrite (ADR 044).",
    "",
    "**Standalone is the ceiling; rewritten is the distance traveled to it.** The",
    "hand-written column is what a perfect rewrite would produce, so it is evidence",
    "about the idea; the rewritten column is evidence about the prompt.",
    "",
    "**Every row is rewritten here; production rewrites almost none of them.** The",
    "route only calls the rewrite when retrieval returned nothing past the 0.40",
    "floor, and `distances.json` puts one of these ten above it. So this column",
    "measures how good the rewrite is when it runs, not how often it runs — which",
    "is what tuning the prompt needs, and is not a claim about recall in the",
    "product.",
    "",
    "Vector alone, and the floor is off as it is everywhere above — so a row",
    "scoring 1.00 here can still be refused in the product, where the floor is",
    "0.40. The closest distance for the typed form is in `distances.json`.",
    "",
    `| follow-up | as asked | rewritten | standalone | the rewrite |`,
    "| --------- | -------- | --------- | ---------- | ----------- |",
    ...followUps.map(
      (row) =>
        // Model output: one pipe would shift every column after it.
        `| ${row.followUp} | ${row.asked.toFixed(2)} | ${row.rewritten.toFixed(2)} | ${row.standalone.toFixed(2)} | ${(row.rewrittenText ?? "_declined_").replaceAll("|", "\\|")} |`,
    ),
    "",
    `Mean **${mean(followUps.map((row) => row.asked)).toFixed(2)} as asked**, ` +
      `**${mean(followUps.map((row) => row.rewritten)).toFixed(2)} rewritten**, ` +
      `**${mean(followUps.map((row) => row.standalone)).toFixed(2)} standalone**. ` +
      `Recall@${String(FOLLOW_UP_K)} throughout.`,
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
      {
        golden: GOLDEN_SET.map((one, index) => ({
          question: one.question,
          answerable: cases[index]!.answerable,
          best: cases[index]!.retrieved[0]?.distance ?? null,
        })),
        followUps: followUps.map((row) => ({
          followUp: row.followUp,
          best: row.bestAsked,
        })),
      },
      null,
      2,
    ) + "\n",
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
