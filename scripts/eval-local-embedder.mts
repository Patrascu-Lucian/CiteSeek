/**
 * The local relevance floor, in memory. Not `pnpm eval:retrieval`: that ingests
 * through Postgres, whose column is `vector(768)`, and these models are 384.
 * Numbers and reasoning in ADR 031.
 *
 * Usage: pnpm eval:local [--fake]
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { GOLDEN_SET } from "../eval/golden-set.ts";
import { LOCAL_EMBEDDING_MODEL, localEmbedder } from "../lib/local/embedder.ts";
import { fakeLocalEmbedder } from "../lib/local/fake-embedder.ts";
import { chunkText } from "../lib/rag/chunking.ts";
import { extractText } from "../lib/rag/extract.ts";
import { RETRIEVAL_LIMIT } from "../lib/rag/retrieval-config.ts";
import { cosineSimilarity } from "../lib/rag/vector.ts";

const FIXTURES = join(import.meta.dirname, "..", "eval", "fixtures");

const FILES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

const THRESHOLDS = [
  0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
  0.85, 0.9, 0.95,
];

const useFake = process.argv.includes("--fake");
const embedder = useFake ? fakeLocalEmbedder : localEmbedder;
const label = useFake ? "fake (bag of words)" : LOCAL_EMBEDDING_MODEL;

/** The shipping embedder, not a second copy of it: a query instruction that
 * drifted between the two would measure a floor nothing uses. */
async function embed(texts: string[], isQuery: boolean): Promise<number[][]> {
  const { vectors } = await embedder(
    texts,
    isQuery ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
  );

  return vectors;
}

type Passage = { file: string; text: string; vector: number[] };

const passages: Passage[] = [];

for (const file of FILES) {
  const bytes = new Uint8Array(await readFile(join(FIXTURES, file)));
  const { text, pageSpans } = await extractText(bytes, "text/markdown");
  const chunks = chunkText(text, pageSpans);
  const vectors = await embed(
    chunks.map((chunk) => chunk.content),
    false,
  );

  chunks.forEach((chunk, index) => {
    passages.push({ file, text: chunk.content, vector: vectors[index]! });
  });
}

console.log(`${label}: ${String(passages.length)} passages`);

const answerable = GOLDEN_SET.filter((one) => one.expect.length > 0);
const unanswerable = GOLDEN_SET.filter((one) => one.expect.length === 0);

const questionVectors = await embed(
  GOLDEN_SET.map((one) => one.question),
  true,
);

/** The best distance any passage achieves, which is what the floor compares. */
const bestDistances = GOLDEN_SET.map((one, index) => {
  const query = questionVectors[index]!;
  const distances = passages.map((p) => 1 - cosineSimilarity(query, p.vector));

  return {
    question: one.question,
    answerable: one.expect.length > 0,
    best: Math.min(...distances),
    hit: passages
      .map((p, i) => ({ p, d: distances[i]! }))
      .sort((a, b) => a.d - b.d)
      .slice(0, RETRIEVAL_LIMIT)
      .some(({ p }) =>
        one.expect.some(
          (e) => e.file === p.file && p.text.includes(e.quote.slice(0, 40)),
        ),
      ),
  };
});

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

const answerableBest = bestDistances
  .filter((d) => d.answerable)
  .map((d) => d.best);
const unanswerableBest = bestDistances
  .filter((d) => !d.answerable)
  .map((d) => d.best);

console.log(
  `\nanswerable   n=${String(answerableBest.length)} min=${Math.min(...answerableBest).toFixed(3)} median=${median(answerableBest).toFixed(3)} max=${Math.max(...answerableBest).toFixed(3)}`,
);
console.log(
  `unanswerable n=${String(unanswerableBest.length)} min=${Math.min(...unanswerableBest).toFixed(3)} median=${median(unanswerableBest).toFixed(3)} max=${Math.max(...unanswerableBest).toFixed(3)}`,
);

console.log(
  `\nrecall@${String(RETRIEVAL_LIMIT)} (no floor): ${((bestDistances.filter((d) => d.answerable && d.hit).length / answerable.length) * 100).toFixed(0)}%`,
);

console.log("\nthreshold  answered  refused-correctly  wrongly-refused");
for (const threshold of THRESHOLDS) {
  const answeredCorrectly = bestDistances.filter(
    (d) => d.answerable && d.best <= threshold && d.hit,
  ).length;
  const refusedCorrectly = bestDistances.filter(
    (d) => !d.answerable && d.best > threshold,
  ).length;
  const wronglyRefused = bestDistances.filter(
    (d) => d.answerable && d.best > threshold,
  ).length;

  console.log(
    `${threshold.toFixed(2)}       ${String(answeredCorrectly).padStart(2)}/${String(answerable.length)}     ${String(refusedCorrectly).padStart(2)}/${String(unanswerable.length)}              ${String(wronglyRefused)}`,
  );
}
