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
import { loadChatModel, resolveLocalGenerator } from "../lib/local/generate.ts";
import { chunkText, type Chunk } from "../lib/rag/chunking.ts";
import { extractText } from "../lib/rag/extract.ts";

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

for (const file of new Set(
  LOCAL_ANSWER_SET.flatMap((one) => one.expect.map((e) => e.file)),
)) {
  const bytes = new Uint8Array(await readFile(join(EVAL, "fixtures", file)));
  const { text, pageSpans } = await extractText(bytes, "text/markdown");
  chunksByFile.set(file, chunkText(text, pageSpans));
}

function sourcesFor(expect: readonly { file: string; quote: string }[]) {
  return expect.map((one, index): ChatSource => {
    const chunk = chunksByFile
      .get(one.file)
      ?.find((c) => c.content.includes(one.quote));

    // A quote no chunk holds is a broken fixture, not a bad answer.
    if (!chunk) throw new Error(`No chunk in ${one.file} holds "${one.quote}"`);

    return {
      chunkId: `${one.file}:${String(chunk.charStart)}`,
      documentId: one.file,
      filename: one.file,
      pageNumber: chunk.pageNumber,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      quote: chunk.content,
      marker: index + 1,
    };
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
  grounded: boolean;
  cited: boolean;
};

const rows: Row[] = [];

for (const [index, one] of LOCAL_ANSWER_SET.entries()) {
  const sources = sourcesFor(one.expect);
  const started = Date.now();

  let answer = "";
  for await (const delta of generate(one.question, sources)) answer += delta;

  // Not `includes`: "5%" matched inside "25%", scoring the cap as the rate.
  const grounded = one.answerContains.some((want) =>
    new RegExp(
      `(?<!\\d)${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "i",
    ).test(answer),
  );
  // In range, so a `[9]` against one passage does not count as cited.
  const cited = [...answer.matchAll(/\[(\d+)\]/g)].some((m) => {
    const marker = Number(m[1]);
    return marker >= 1 && marker <= sources.length;
  });

  rows.push({ question: one.question, answer: answer.trim(), grounded, cited });
  console.log(
    `  ${String(index + 1)}/${String(LOCAL_ANSWER_SET.length)} ${grounded ? "grounded" : "WRONG   "} ${cited ? "cited" : "uncited"}  ${String(Math.round((Date.now() - started) / 1000))}s`,
  );
}

const share = (of: (row: Row) => boolean) =>
  `${String(rows.filter(of).length)}/${String(rows.length)}`;

const report = [
  "# Local answers",
  "",
  `Run ${new Date().toISOString().slice(0, 10)} against \`${useFake ? "the fake generator" : "onnx-community/Qwen2.5-0.5B-Instruct"}\`.`,
  "",
  "The passage is handed to the model rather than retrieved, so a wrong answer",
  "here is the model's and not the floor's. `grounded` is a substring check",
  "against expected spellings of the fact — a floor, not a grade: it cannot tell",
  "a value from a negated one. The answers are printed because the failure on",
  "record is a shape, a marker standing where a number belongs, and a regex for",
  "that would measure the regex.",
  "",
  `**${share((row) => row.grounded)} grounded, ${share((row) => row.cited)} cited.**`,
  "",
  "| question | grounded | cited |",
  "| -------- | -------- | ----- |",
  ...rows.map(
    (row) =>
      `| ${row.question} | ${row.grounded ? "yes" : "**no**"} | ${row.cited ? "yes" : "**no**"} |`,
  ),
  "",
  "## Answers",
  "",
  ...rows.flatMap((row) => [
    `**${row.question}**`,
    "",
    "> " + (row.answer || "_(empty)_").replaceAll("\n", "\n> "),
    "",
  ]),
].join("\n");

// `--fake` exercises the harness; it must not overwrite a real run's record.
if (!useFake) await writeFile(join(EVAL, "local-answers.md"), report + "\n");

console.log(
  `\n${share((row) => row.grounded)} grounded, ${share((row) => row.cited)} cited.` +
    (useFake ? " Not written: --fake." : " Written to eval/local-answers.md"),
);
