/**
 * What the local model answers, given the right passage. The passage is handed
 * over rather than retrieved, so a wrong answer is the model's (ADR 033).
 *
 * Free — no provider, no database. Slow: CPU generation.
 *
 * Usage: pnpm eval:local-answers [--fake]
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { LOCAL_ANSWER_SET } from "../eval/golden-set.ts";
import type { ChatSource } from "../lib/ai/types.ts";
import { localEmbedder } from "../lib/local/embedder.ts";
import { loadChatModel, resolveLocalGenerator } from "../lib/local/generate.ts";
import { chunkText, type Chunk } from "../lib/rag/chunking.ts";
import { extractText } from "../lib/rag/extract.ts";
import { RETRIEVAL_LIMIT } from "../lib/rag/retrieval-config.ts";
import { cosineSimilarity } from "../lib/rag/vector.ts";

const FIXTURE_FILES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

const useFake = process.argv.includes("--fake");

// Read by `resolveLocalGenerator`, and set before it is called.
if (useFake) {
  (globalThis as { __citeseekLocalEmbedder?: string }).__citeseekLocalEmbedder =
    "fake";
}

const EVAL = join(import.meta.dirname, "..", "eval");
const generate = resolveLocalGenerator();

/** The chunk holding the quote, not the quote: that is what retrieval gives it. */
const chunksByFile = new Map<string, Chunk[]>();

// Every fixture, not only the cited ones: a distractor from another document is
// exactly what retrieval hands over in a real workspace.
for (const file of FIXTURE_FILES) {
  const bytes = new Uint8Array(await readFile(join(EVAL, "fixtures", file)));
  const { text, pageSpans } = await extractText(bytes, "text/markdown");
  chunksByFile.set(file, chunkText(text, pageSpans));
}

/** Ranked by the local embedder, which is what local mode retrieves with — so
 * the distractors are the ones a reader would actually get. */
const ranked = new Map<string, { file: string; chunk: Chunk }[]>();

if (!useFake) {
  const all = [...chunksByFile].flatMap(([file, chunks]) =>
    chunks.map((chunk) => ({ file, chunk })),
  );
  const { vectors } = await localEmbedder(
    all.map((one) => one.chunk.content),
    "RETRIEVAL_DOCUMENT",
  );

  for (const one of LOCAL_ANSWER_SET) {
    const { vectors: query } = await localEmbedder(
      [one.question],
      "RETRIEVAL_QUERY",
    );
    ranked.set(
      one.question,
      all
        .map((entry, index) => ({
          ...entry,
          score: cosineSimilarity(query[0]!, vectors[index]!),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, RETRIEVAL_LIMIT),
    );
  }
}

const asSource = (file: string, chunk: Chunk): Omit<ChatSource, "marker"> => ({
  chunkId: `${file}:${String(chunk.charStart)}`,
  documentId: file,
  filename: file,
  pageNumber: chunk.pageNumber,
  charStart: chunk.charStart,
  charEnd: chunk.charEnd,
  quote: chunk.content,
});

function sourcesFor(expect: readonly { file: string; quote: string }[]) {
  return expect.map((one, index): ChatSource => {
    const chunk = chunksByFile
      .get(one.file)
      ?.find((c) => c.content.includes(one.quote));

    // A quote no chunk holds is a broken fixture, not a bad answer.
    if (!chunk) throw new Error(`No chunk in ${one.file} holds "${one.quote}"`);

    return { ...asSource(one.file, chunk), marker: index + 1 };
  });
}

if (!useFake) {
  // First call wins the module singleton, so `generateLocally` reuses this one.
  console.log("Loading the model (756 MB on a first run)…");
  await loadChatModel(
    ({ loaded, total }) =>
      process.stdout.write(
        `\r  ${String(Math.round((loaded / total) * 100))}%   `,
      ),
    "cpu",
  );
  console.log("\n");
}

type Row = {
  question: string;
  answer: string;
  manyAnswer: string;
  grounded: boolean;
  groundedMany: boolean;
  cited: boolean;
  retrieved: boolean;
};

const rows: Row[] = [];

// Not `includes`: "5%" matched inside "25%", scoring the cap as the rate.
const grounds = (answer: string, wants: readonly string[]) =>
  wants.some((want) =>
    new RegExp(
      `(?<!\\d)${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "i",
    ).test(answer),
  );

async function ask(question: string, sources: readonly ChatSource[]) {
  let answer = "";
  for await (const delta of generate(question, sources)) answer += delta;

  // In range, so a `[9]` against one passage does not count as cited.
  const cited = [...answer.matchAll(/\[(\d+)\]/g)].some((m) => {
    const marker = Number(m[1]);
    return marker >= 1 && marker <= sources.length;
  });

  return { answer: answer.trim(), cited };
}

for (const [index, one] of LOCAL_ANSWER_SET.entries()) {
  const started = Date.now();
  const alone = sourcesFor(one.expect);

  /* The same question twice: with the answering passage alone, and with the
     eight the router would have retrieved. The first is the ceiling this harness
     measured before; the second is what a reader gets. */
  const withDistractors = ranked.get(one.question);
  const many = withDistractors
    ? withDistractors.map((entry, marker): ChatSource => ({
        ...asSource(entry.file, entry.chunk),
        marker: marker + 1,
      }))
    : alone;

  const one1 = await ask(one.question, alone);
  const many1 = await ask(one.question, many);

  rows.push({
    question: one.question,
    answer: one1.answer,
    manyAnswer: many1.answer,
    grounded: grounds(one1.answer, one.answerContains),
    groundedMany: grounds(many1.answer, one.answerContains),
    cited: one1.cited,
    // Did retrieval even find it? A miss makes the row retrieval's failure.
    retrieved: many.some((source) =>
      one.expect.some((e) => source.quote.includes(e.quote)),
    ),
  });

  const row = rows.at(-1)!;
  console.log(
    `  ${String(index + 1)}/${String(LOCAL_ANSWER_SET.length)} one:${row.grounded ? "ok  " : "WRONG"} ${String(RETRIEVAL_LIMIT)}:${row.groundedMany ? "ok  " : "WRONG"} ${row.retrieved ? "" : "(not retrieved) "}${String(Math.round((Date.now() - started) / 1000))}s`,
  );
}

const share = (of: (row: Row) => boolean) =>
  `${String(rows.filter(of).length)}/${String(rows.length)}`;

const report = [
  "# Local answers",
  "",
  `Run ${new Date().toISOString().slice(0, 10)} against \`${useFake ? "the fake generator" : "onnx-community/Qwen2.5-0.5B-Instruct"}\`.`,
  "",
  "Each question is asked twice: with the answering passage alone, and with the",
  `${String(RETRIEVAL_LIMIT)} the local embedder ranks highest — which is what a reader gets. The`,
  "first column is a ceiling, the second is the product.",
  "",
  "`grounded` is a substring check against expected spellings of the fact, on a",
  "digit boundary. A floor, not a grade: it cannot tell a value from a negated",
  "one. The answers are printed because the failure on record is a shape — a",
  "marker standing where a number belongs — and a regex for that would measure",
  "the regex.",
  "",
  `**Grounded ${share((row) => row.grounded)} on the passage alone, ` +
    `${share((row) => row.groundedMany)} on ${String(RETRIEVAL_LIMIT)}. ` +
    `Cited ${share((row) => row.cited)}.**`,
  "",
  `| question | alone | ${String(RETRIEVAL_LIMIT)} passages | retrieved |`,
  "| -------- | ----- | ----------- | --------- |",
  ...rows.map(
    (row) =>
      `| ${row.question} | ${row.grounded ? "yes" : "**no**"} | ${row.groundedMany ? "yes" : "**no**"} | ${row.retrieved ? "yes" : "**no**"} |`,
  ),
  "",
  "## Answers",
  "",
  ...rows.flatMap((row) => [
    `**${row.question}**`,
    "",
    "Passage alone:",
    "",
    "> " + (row.answer || "_(empty)_").replaceAll("\n", "\n> "),
    "",
    `With ${String(RETRIEVAL_LIMIT)}:`,
    "",
    "> " + (row.manyAnswer || "_(empty)_").replaceAll("\n", "\n> "),
    "",
  ]),
].join("\n");

// `--fake` exercises the harness; it must not overwrite a real run's record.
if (!useFake) await writeFile(join(EVAL, "local-answers.md"), report + "\n");

console.log(
  `\n${share((row) => row.grounded)} alone, ${share((row) => row.groundedMany)} with ${String(RETRIEVAL_LIMIT)}, ${share((row) => row.cited)} cited.` +
    (useFake ? " Not written: --fake." : " Written to eval/local-answers.md"),
);
