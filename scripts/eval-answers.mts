/** What Gemini answers to questions the documents can answer, at each passage
 * count or chunk size. Retrieval, prompt and generation are the chat route's
 * own, so a change this decides is a change to what ships (ADR 059).
 *
 * Usage: pnpm eval:answers [--fake] [--counts=3,8] [--chunk=400,600,800]
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";
import { namesHost } from "../lib/env/named-host.ts";
import { ANSWER_SET, type Expectation } from "../eval/golden-set.ts";
import { grounds } from "../eval/scoring.ts";
import type { ChunkSizes } from "../lib/rag/chunking.ts";
import type { Span } from "../lib/rag/eval-metrics.ts";

const FLAGS = ["--fake", "--counts=", "--chunk="];

/* A misspelled flag is silently the default, and the default writes the
   committed report. */
const unknown = process.argv
  .slice(2)
  .filter((one) => one.startsWith("--"))
  .find(
    (one) =>
      !FLAGS.some((flag) =>
        flag.endsWith("=") ? one.startsWith(flag) : one === flag,
      ),
  );
if (unknown) {
  throw new Error(`Unknown flag ${unknown}. Known: ${FLAGS.join(" ")}`);
}

const useFake = process.argv.includes("--fake");
const listFlag = (name: string) =>
  process.argv
    .find((one) => one.startsWith(name))
    ?.slice(name.length)
    .split(",")
    .map(Number);

// Read before `loadLocalEnv`: `.env.local` must not be what decides to spend
// money, or which database to write to.
const exportedChatProvider = process.env.CHAT_PROVIDER;
const confirmedHost = process.env.EVAL_HOST;

// The smoke run is free: both providers fake, so the table proves the plumbing
// and nothing about Gemini, which is why it writes no report.
if (useFake) {
  process.env.CHAT_PROVIDER = "fake";
  process.env.EMBEDDINGS_PROVIDER = "fake";
}

loadLocalEnv();

if (!useFake && exportedChatProvider?.trim().toLowerCase() !== "google") {
  throw new Error(
    "Export CHAT_PROVIDER=google, or pass --fake for a free smoke run. The fake " +
      "model returns a fixture, which would score the fixture.",
  );
}

const embeddings = process.env.EMBEDDINGS_PROVIDER?.trim().toLowerCase();
if (!useFake && embeddings && embeddings !== "google") {
  throw new Error(
    "The floor is calibrated per embedding model, so these answers would come " +
      "from passages the product would not send. Unset EMBEDDINGS_PROVIDER, or set it to google.",
  );
}

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
process.env.DATABASE_URL = connectionString;

const hostname = new URL(connectionString).hostname;
const LOCAL = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal)$/;

if (!LOCAL.test(hostname) && !namesHost(confirmedHost, hostname)) {
  throw new Error(
    `Refusing to run against ${hostname}. Name it: EVAL_HOST=${hostname.split(".")[0]}`,
  );
}

const RUNS = Number(process.env.ANSWER_RUNS ?? 3);
// Odd, so a question's majority across runs is never a tie.
if (!Number.isInteger(RUNS) || RUNS < 1 || RUNS % 2 === 0) {
  throw new Error(
    `ANSWER_RUNS must be an odd whole number, not "${String(process.env.ANSWER_RUNS)}".`,
  );
}

console.log(
  `Evaluating against ${hostname}${useFake ? " (fake providers)" : ""}\n`,
);

const { eq } = await import("drizzle-orm");
const { db } = await import("../lib/db/index.ts");
const { chunks, workspaces } = await import("../lib/db/schema.ts");
const { createQueuedDocument, findDocumentInWorkspace } =
  await import("../lib/documents/queries.ts");
const { processDocument } = await import("../lib/rag/ingest.ts");
const { retrieveChunks } = await import("../lib/rag/retrieve.ts");
const { RETRIEVAL_LIMIT } = await import("../lib/rag/retrieval-config.ts");
const { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS } =
  await import("../lib/rag/chunking.ts");
const { buildSources, buildSystemPrompt } = await import("../lib/ai/prompt.ts");
const { getChatModel } = await import("../lib/ai/provider.ts");
const { markerVerdict, opensWithRefusal } =
  await import("../lib/ai/citations.ts");
const { CHAT_STEP_LIMIT, chatTools } = await import("../lib/chats/tools.ts");
const { citesExpected, comparePaired, decideDefault, isAnswering, majority } =
  await import("../lib/rag/eval-metrics.ts");
const { generateText } = await import("ai");

type ChatSource = ReturnType<typeof buildSources>[number];

const counts = (listFlag("--counts=") ?? [3, RETRIEVAL_LIMIT]).sort(
  (a, b) => a - b,
);
if (counts.some((one) => !Number.isInteger(one) || one < 1)) {
  throw new Error(
    `--counts must be whole numbers of at least 1, got: ${counts.join()}`,
  );
}

/* Each target keeps the shipped ratio of maximum and overlap to target, so the
   size is the only thing that changes between rows. */
const chunkTargets = listFlag("--chunk=")?.sort((a, b) => a - b);
if (chunkTargets) {
  if (chunkTargets.some((one) => !Number.isInteger(one) || one < 100)) {
    throw new Error(
      `--chunk must be whole numbers of at least 100, got: ${chunkTargets.join()}`,
    );
  }
  // The shipped size is the baseline, measured in the same session.
  if (!chunkTargets.includes(CHUNK_TARGET_CHARS)) {
    throw new Error(`--chunk must include ${String(CHUNK_TARGET_CHARS)}.`);
  }
  if (counts.length !== 1) {
    throw new Error(
      "--chunk compares sizes at one passage count: pass one --counts=.",
    );
  }
}

const sizesFor = (target: number): ChunkSizes => ({
  target,
  max: Math.round((target * CHUNK_MAX_CHARS) / CHUNK_TARGET_CHARS),
  overlap: Math.round((target * CHUNK_OVERLAP_CHARS) / CHUNK_TARGET_CHARS),
});

const EVAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "eval");
const FIXTURES = join(EVAL_DIR, "fixtures");
const FILES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

type Scored = {
  text: string;
  grounded: boolean;
  cites: boolean;
  declined: boolean;
  inputTokens: number;
};

/** What the route sends when the floor refuses: no model call. */
const REFUSED: Scored = {
  text: "(refused by the floor)",
  grounded: false,
  cites: false,
  declined: true,
  inputTokens: 0,
};

type Row = {
  question: string;
  given: number;
  charsGiven: number;
  retrieved: boolean;
  runs: Scored[];
};

type Setting = { name: string; rows: Row[] };

type Measured = {
  settings: Setting[];
  corpus: number;
  passageLength: number;
};

type Corpus = {
  workspaceId: string;
  stored: {
    id: string;
    documentId: string;
    content: string;
    pageNumber: number | null;
    charStart: number;
    charEnd: number;
  }[];
  spansFor: (expect: readonly Expectation[]) => Span[];
  /** `ANSWER_SET`'s, by index. */
  spans: Span[][];
  filenameOf: (documentId: string) => string;
};

/** Ingests the fixtures at `sizes` into a workspace of its own, hands it to
 * `run`, and deletes it whatever `run` does. */
async function withCorpus<T>(
  sizes: ChunkSizes | undefined,
  run: (corpus: Corpus) => Promise<T>,
): Promise<T> {
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `answers ${new Date().toISOString()}`, ownerId: null })
    .returning({ id: workspaces.id });
  const workspaceId = workspace!.id;

  try {
    const textByFile = new Map<string, string>();
    const idByFile = new Map<string, string>();

    for (const file of FILES) {
      const bytes = new Uint8Array(await readFile(join(FIXTURES, file)));
      const document = await createQueuedDocument(workspaceId, {
        filename: file,
        mimeType: "text/markdown",
        sizeBytes: bytes.length,
      });
      await processDocument(workspaceId, document.id, bytes, "text/markdown", {
        chunkSizes: sizes,
      });
      const stored = await findDocumentInWorkspace(workspaceId, document.id);
      // `processDocument` records a failure on the row rather than throwing, and
      // a failed document reads as its questions missed by retrieval.
      if (stored?.status !== "ready") {
        throw new Error(`${file} did not ingest: ${String(stored?.error)}`);
      }
      // Offsets index the stored text, which normalization has already rewritten.
      textByFile.set(file, stored?.contentText ?? "");
      idByFile.set(file, document.id);
    }

    const spansFor = (expect: readonly Expectation[]): Span[] =>
      expect.map(({ file, quote }) => {
        const charStart = (textByFile.get(file) ?? "").indexOf(quote);
        if (charStart === -1)
          throw new Error(`Quote not found in ${file}: "${quote}"`);
        return {
          documentId: idByFile.get(file)!,
          charStart,
          charEnd: charStart + quote.length,
        };
      });

    // Before the first paid call: a missing quote found halfway through would
    // throw the run away.
    const spans = ANSWER_SET.map((one) => spansFor(one.expect));

    const stored = await db
      .select({
        id: chunks.id,
        documentId: chunks.documentId,
        content: chunks.content,
        pageNumber: chunks.pageNumber,
        charStart: chunks.charStart,
        charEnd: chunks.charEnd,
      })
      .from(chunks)
      .where(eq(chunks.workspaceId, workspaceId))
      .orderBy(chunks.documentId, chunks.chunkIndex);

    console.log(
      `  ${sizes ? `${String(sizes.target)} characters: ` : ""}the corpus is ${String(stored.length)} passages.`,
    );

    // Awaited: without it `finally` empties the workspace mid-run, and every
    // question then scores as refused by the floor, with no error.
    return await run({
      workspaceId,
      stored,
      spansFor,
      spans,
      filenameOf: (documentId) =>
        [...idByFile].find(([, id]) => id === documentId)![0],
    });
  } finally {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  }
}

function scoreReply(
  text: string,
  sources: ChatSource[],
  index: number,
  { spans, stored }: Corpus,
  inputTokens: number,
): Scored {
  return {
    text: text.trim(),
    grounded: grounds(text, ANSWER_SET[index]!.answerContains),
    cites: citesExpected(
      markerVerdict(text, sources).linked,
      sources,
      spans[index]!,
      stored,
    ),
    declined: opensWithRefusal(text),
    inputTokens,
  };
}

/** Answers every question at each count, and with the oracle, on a corpus
 * ingested at `sizes`. */
async function measure(
  sizes: ChunkSizes | undefined,
  withOracle: boolean,
): Promise<Measured> {
  return withCorpus(sizes, async (corpus) => {
    const { workspaceId, stored, spans, filenameOf } = corpus;

    /** The stored passage holding the answer, handed over on its own: the
     * ceiling retrieval cannot beat, so a miss below it is retrieval's or the
     * model's. */
    const oracleFor = (index: number): ChatSource[] => {
      const passage = stored.find((chunk) =>
        isAnswering(chunk, spans[index]!, stored),
      );
      if (!passage)
        throw new Error(
          `No stored passage holds: ${ANSWER_SET[index]!.question}`,
        );
      return [
        {
          marker: 1,
          chunkId: passage.id,
          documentId: passage.documentId,
          filename: filenameOf(passage.documentId),
          pageNumber: passage.pageNumber,
          charStart: passage.charStart,
          charEnd: passage.charEnd,
          quote: passage.content,
        },
      ];
    };

    const answer = async (
      question: string,
      sources: ChatSource[],
      index: number,
    ): Promise<Scored> => {
      const { text, usage } = await generateText({
        model: getChatModel(),
        system: buildSystemPrompt(sources),
        prompt: question,
        tools: chatTools(workspaceId),
        stopWhen: CHAT_STEP_LIMIT,
      });
      return scoreReply(text, sources, index, corpus, usage.inputTokens ?? 0);
    };

    const settings: Setting[] = [];

    for (const count of [
      ...counts,
      ...(withOracle ? (["oracle"] as const) : []),
    ]) {
      const rows: Row[] = [];

      for (const [index, one] of ANSWER_SET.entries()) {
        const sources =
          count === "oracle"
            ? oracleFor(index)
            : buildSources(
                (
                  await retrieveChunks(workspaceId, one.question, {
                    limit: count,
                  })
                ).chunks,
              );
        const retrieved = sources.some((source) =>
          isAnswering(source, spans[index]!, stored),
        );

        const runs: Scored[] = [];
        // A question the floor refuses gets the route's refusal at every count,
        // with no model call, so it scores the same on both sides.
        for (let run = 0; run < RUNS; run += 1) {
          runs.push(
            sources.length === 0
              ? REFUSED
              : await answer(one.question, sources, index),
          );
        }
        rows.push({
          question: one.question,
          given: sources.length,
          charsGiven: sources.reduce((sum, s) => sum + s.quote.length, 0),
          retrieved,
          runs,
        });
      }

      const name =
        count === "oracle"
          ? "oracle"
          : sizes
            ? `${String(sizes.target)} chars`
            : `${String(count)} passages`;
      settings.push({ name, rows });
      console.log(`  ${name}: ${summary(rows)}`);
    }

    const lengths = stored.map((chunk) => chunk.content.length);
    return {
      settings,
      corpus: stored.length,
      passageLength: lengths.reduce((a, b) => a + b, 0) / lengths.length,
    };
  });
}

const outcome = (rows: Row[], key: "grounded" | "cites") =>
  new Map(
    rows.map((row) => [
      row.question,
      majority(row.runs.map((run) => run[key])),
    ]),
  );

/** Every setting but the baseline, judged against it by the committed rule. */
function compare(settings: Setting[], baseline: Setting, minGains: number) {
  return settings
    .filter((one) => one.name !== "oracle" && one !== baseline)
    .map((one) => {
      const grounded = comparePaired(
        outcome(baseline.rows, "grounded"),
        outcome(one.rows, "grounded"),
      );
      const cites = comparePaired(
        outcome(baseline.rows, "cites"),
        outcome(one.rows, "cites"),
      );
      return {
        name: one.name,
        grounded,
        cites,
        verdict: decideDefault({ grounded, cites }, minGains),
      };
    });
}

let file: string;
let rendered: string;
let verdicts: ReturnType<typeof compare> = [];

if (chunkTargets) {
  const sized = [];
  for (const target of chunkTargets) {
    sized.push({ target, ...(await measure(sizesFor(target), false)) });
  }
  const settings = sized.map((one) => one.settings[0]!);
  const baseline = settings[chunkTargets.indexOf(CHUNK_TARGET_CHARS)]!;
  // A higher bar than a passage count's: a chunk size moves the floor, local
  // mode and every stored document with it.
  const comparisons = compare(settings, baseline, 3);
  verdicts = comparisons;

  file = "answers-chunks.md";
  rendered = report({
    title: `What Gemini answers at each chunk size, ${String(counts[0])} passages`,
    intro: [
      "Each size keeps the shipped ratio of maximum and overlap to target, and is",
      "ingested into a workspace of its own. At the same passage count a larger",
      "chunk shows more of a small corpus, so a gain that tracks the characters",
      "given is the corpus's, not the size's.",
      "",
      "| target | max | overlap | corpus passages | mean passage length |",
      "| ------ | --- | ------- | --------------- | ------------------- |",
      ...sized.map(({ target, corpus, passageLength }) => {
        const sizes = sizesFor(target);
        return `| ${String(target)} | ${String(sizes.max)} | ${String(sizes.overlap)} | ${String(corpus)} | ${passageLength.toFixed(0)} |`;
      }),
    ],
    settings,
    comparisons,
    against: `the shipped ${String(CHUNK_TARGET_CHARS)} characters`,
    bar: "at least three get better",
  });
} else {
  const { settings, corpus } = await measure(undefined, true);
  const baseline = settings.find(
    (one) => one.name === `${String(RETRIEVAL_LIMIT)} passages`,
  );
  const comparisons = baseline ? compare(settings, baseline, 1) : [];
  verdicts = comparisons;

  file = "answers.md";
  rendered = report({
    title: "What Gemini answers, at each passage count",
    intro: [
      `The corpus is ${String(corpus)} passages, so at eight a question sees a large`,
      "share of it.",
    ],
    settings,
    comparisons,
    against: `the shipped ${String(RETRIEVAL_LIMIT)}`,
    bar: "at least one gets better",
  });
}

for (const one of verdicts) {
  console.log(
    `  ${one.name}: ${one.verdict} (grounded +${String(one.grounded.gained.length)} −${String(one.grounded.lost.length)}, cites +${String(one.cites.gained.length)} −${String(one.cites.lost.length)})`,
  );
}

// Rendered either way: a report that throws after the last paid call loses the
// whole run, so the free smoke run exercises it too.
if (useFake) {
  console.log(
    `\n--fake: ${file} renders (${String(rendered.split("\n").length)} lines), and nothing is written.`,
  );
} else {
  await writeFile(join(EVAL_DIR, file), rendered);
  console.log(`\nWrote eval/${file}`);
}

function summary(rows: Row[]): string {
  const count = (key: "grounded" | "cites" | "declined") =>
    rows.filter((row) => majority(row.runs.map((run) => run[key]))).length;
  return `grounded ${String(count("grounded"))}/${String(rows.length)}, cites ${String(count("cites"))}, declined ${String(count("declined"))}`;
}

function report({
  title,
  intro,
  settings,
  comparisons,
  against,
  bar,
}: {
  title: string;
  intro: string[];
  settings: Setting[];
  comparisons: ReturnType<typeof compare>;
  against: string;
  bar: string;
}): string {
  const total = ANSWER_SET.length;
  const perRun = (rows: Row[], key: "grounded" | "cites") =>
    Array.from(
      { length: RUNS },
      (_, run) => rows.filter((row) => row.runs[run]![key]).length,
    ).join(", ");
  const majorityOf = (rows: Row[], key: "grounded" | "cites" | "declined") =>
    rows.filter((row) => majority(row.runs.map((run) => run[key]))).length;
  const mean = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
  const answered = (row: Row) => row.runs.filter((run) => run.inputTokens > 0);
  const tableRow = (cells: string[]) => `| ${cells.join(" | ")} |`;

  const cell = (row: Row, key: "grounded" | "cites") =>
    majority(row.runs.map((run) => run[key]))
      ? "yes"
      : row.retrieved
        ? "**no**"
        : "_missed_";

  return [
    `# ${title}`,
    "",
    `Run ${new Date().toISOString().slice(0, 10)} by \`pnpm eval:answers\`: the ${String(total)} value`,
    "questions in `ANSWER_SET`, against the three eval fixtures ingested through",
    "the shipped pipeline and retrieved with `retrieveChunks`, floor included.",
    `${String(RUNS)} runs; a question's result is the majority of them.`,
    "",
    ...intro,
    "",
    "`grounded` is the expected value appearing in the answer, a floor rather than",
    "a grade. `cites` is a marker the page links pointing at a passage that holds",
    "the answer. `declined` is a reply opening in the declining form: on these",
    "questions, a false refusal.",
    "",
    "| setting | given (mean) | chars given (mean) | answer retrieved | grounded | grounded per run | cites | cites per run | declined | input tokens (mean) |",
    "| ------- | ------------ | ------------------ | ---------------- | -------- | ---------------- | ----- | ------------- | -------- | ------------------- |",
    ...settings.map(({ name, rows }) =>
      tableRow([
        name,
        mean(rows.map((row) => row.given)).toFixed(1),
        mean(rows.map((row) => row.charsGiven)).toFixed(0),
        `${String(rows.filter((row) => row.retrieved).length)}/${String(total)}`,
        `${String(majorityOf(rows, "grounded"))}/${String(total)}`,
        perRun(rows, "grounded"),
        `${String(majorityOf(rows, "cites"))}/${String(total)}`,
        perRun(rows, "cites"),
        `${String(majorityOf(rows, "declined"))}/${String(total)}`,
        Math.round(
          mean(
            rows.flatMap((row) => answered(row).map((run) => run.inputTokens)),
          ),
        ).toString(),
      ]),
    ),
    "",
    "## The comparison, by a rule committed before this run",
    "",
    `Against ${against}: a setting replaces it only if no question gets worse on`,
    `either outcome and ${bar}.`,
    "",
    ...comparisons.flatMap((one) => [
      `**${one.name}: ${one.verdict}.**`,
      "",
      `- grounded: gained ${list(one.grounded.gained)}; lost ${list(one.grounded.lost)}`,
      `- cites: gained ${list(one.cites.gained)}; lost ${list(one.cites.lost)}`,
      "",
    ]),
    "## Per question",
    "",
    "`_missed_` is retrieval not returning the answering passage for that setting;",
    "**no** is the model having it and not using it.",
    "",
    tableRow([
      "question",
      ...settings.map(({ name }) => `grounded @${name}`),
      ...settings.map(({ name }) => `cites @${name}`),
    ]),
    tableRow(["---", ...settings.flatMap(() => ["---", "---"])]),
    ...ANSWER_SET.map((one, index) =>
      tableRow([
        one.question,
        ...settings.map(({ rows }) => cell(rows[index]!, "grounded")),
        ...settings.map(({ rows }) => cell(rows[index]!, "cites")),
      ]),
    ),
    "",
    ...settings.flatMap(({ name, rows }) =>
      rows.flatMap((row) =>
        row.runs.flatMap((run, index) => [
          `## ${name} — run ${String(index + 1)} — ${row.question}`,
          "",
          `Grounded: ${String(run.grounded)} · cites: ${String(run.cites)} · declined: ${String(run.declined)}`,
          "",
          run.text,
          "",
        ]),
      ),
    ),
  ].join("\n");
}

function list(questions: string[]): string {
  return questions.length === 0
    ? "none"
    : questions.map((q) => `"${q}"`).join(", ");
}
