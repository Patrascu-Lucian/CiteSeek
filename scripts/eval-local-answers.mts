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

/** Both halves at every count: fewer passages read better and retrieve worse, so
 * grounding alone would recommend a number that drops the answer. */
const COUNTS = [1, 2, 3, 4, RETRIEVAL_LIMIT];

type At = { grounded: boolean; retrieved: boolean; answer: string };

type Row = {
  question: string;
  /** The answering passage handed over — the ceiling retrieval cannot beat. */
  oracle: { grounded: boolean; cited: boolean; answer: string };
  at: Map<number, At>;
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

  const oracleSources = sourcesFor(one.expect);
  const oracle = await ask(one.question, oracleSources);

  const top = ranked.get(one.question) ?? [];
  const at = new Map<number, At>();

  for (const count of COUNTS) {
    const sources = top.slice(0, count).map((entry, marker): ChatSource => ({
      ...asSource(entry.file, entry.chunk),
      marker: marker + 1,
    }));

    // No ranking means `--fake`; scoring the oracle again would invent a sweep.
    if (sources.length === 0) continue;

    const { answer } = await ask(one.question, sources);
    at.set(count, {
      answer,
      grounded: grounds(answer, one.answerContains),
      retrieved: sources.some((source) =>
        one.expect.some((e) => source.quote.includes(e.quote)),
      ),
    });
  }

  rows.push({
    question: one.question,
    oracle: {
      answer: oracle.answer,
      cited: oracle.cited,
      grounded: grounds(oracle.answer, one.answerContains),
    },
    at,
  });

  const sweep = COUNTS.map((count) => {
    const result = at.get(count);
    if (!result) return "-";
    return result.grounded ? "o" : result.retrieved ? "x" : "·";
  }).join("");
  console.log(
    `  ${String(index + 1)}/${String(LOCAL_ANSWER_SET.length)} oracle:${rows.at(-1)!.oracle.grounded ? "ok  " : "WRONG"} sweep:${sweep}  ${String(Math.round((Date.now() - started) / 1000))}s`,
  );
}

const share = (of: (row: Row) => boolean) =>
  `${String(rows.filter(of).length)}/${String(rows.length)}`;

const rate = (of: (one: At) => boolean, count: number) => {
  const seen = rows
    .map((row) => row.at.get(count))
    .filter((one) => one !== undefined);

  return seen.length === 0
    ? "-"
    : `${String(seen.filter(of).length)}/${String(seen.length)}`;
};

const report = [
  "# Local answers",
  "",
  `Run ${new Date().toISOString().slice(0, 10)} against \`${useFake ? "the fake generator" : "onnx-community/Qwen2.5-0.5B-Instruct"}\`.`,
  "",
  "Local mode end to end: the local embedder ranks the passages, the local model",
  "answers from them. `oracle` hands the answering passage over instead, so it is",
  "the ceiling retrieval cannot beat.",
  "",
  "Both halves at every count, because they move in opposite directions — fewer",
  "passages read better and retrieve worse, so grounding alone would recommend a",
  "number that drops the answer.",
  "",
  "`grounded` is a substring check on a digit boundary. A floor, not a grade: it",
  "cannot tell a value from a negated one.",
  "",
  "| passages | grounded | answer retrieved |",
  "| -------- | -------- | ---------------- |",
  ...COUNTS.map(
    (count) =>
      `| ${String(count)} | ${rate((one) => one.grounded, count)} | ${rate((one) => one.retrieved, count)} |`,
  ),
  `| oracle | ${share((row) => row.oracle.grounded)} | by construction |`,
  "",
  `Cited ${share((row) => row.oracle.cited)} on the oracle passage.`,
  "",
  "## Per question",
  "",
  `| question | ${COUNTS.map(String).join(" | ")} | oracle |`,
  `| -------- | ${COUNTS.map(() => "-").join(" | ")} | ------ |`,
  ...rows.map((row) => {
    const cells = COUNTS.map((count) => {
      const one = row.at.get(count);
      if (!one) return "-";
      return one.grounded ? "yes" : one.retrieved ? "**no**" : "_missed_";
    });
    return `| ${row.question} | ${cells.join(" | ")} | ${row.oracle.grounded ? "yes" : "**no**"} |`;
  }),
  "",
  "`_missed_` is retrieval not returning the answering passage at that count;",
  "**no** is the model having it and not using it.",
  "",
  "## Answers, on the oracle passage",
  "",
  ...rows.flatMap((row) => [
    `**${row.question}**`,
    "",
    "> " + (row.oracle.answer || "_(empty)_").replaceAll("\n", "\n> "),
    "",
  ]),
].join("\n");

// `--fake` exercises the harness; it must not overwrite a real run's record.
if (!useFake) await writeFile(join(EVAL, "local-answers.md"), report + "\n");

console.log(
  `\n${COUNTS.map((count) => `${String(count)}:${rate((one) => one.grounded, count)}`).join("  ")}  oracle:${share((row) => row.oracle.grounded)}` +
    (useFake ? " Not written: --fake." : " Written to eval/local-answers.md"),
);
