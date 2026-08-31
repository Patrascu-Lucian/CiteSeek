/**
 * Whether a follow-up can be recovered without a model (ADR 048). Free: the
 * local embedder in memory, no provider.
 *
 * Usage: pnpm eval:local-followups [--fake]
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { FOLLOW_UP_SET, type Expectation } from "../eval/golden-set.ts";
import { LOCAL_EMBEDDING_MODEL, localEmbedder } from "../lib/local/embedder.ts";
import { fakeLocalEmbedder } from "../lib/local/fake-embedder.ts";
import { chunkText } from "../lib/rag/chunking.ts";
import { extractText } from "../lib/rag/extract.ts";
import {
  LOCAL_RETRIEVAL_LIMIT,
  maxDistanceFor,
} from "../lib/rag/retrieval-config.ts";
import { cosineSimilarity } from "../lib/rag/vector.ts";

const FIXTURES = join(import.meta.dirname, "..", "eval", "fixtures");

const FILES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

const useFake = process.argv.includes("--fake");
const embedder = useFake ? fakeLocalEmbedder : localEmbedder;

const embed = async (texts: string[], isQuery: boolean) =>
  (await embedder(texts, isQuery ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT"))
    .vectors;

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

/** The product's own path: floor first, then the count (`lib/local/retrieve.ts`). */
async function retrieved(query: string) {
  const [vector] = await embed([query], true);
  const floor = maxDistanceFor(useFake ? "local-fake" : "local");

  return passages
    .map((passage) => ({
      passage,
      distance: 1 - cosineSimilarity(vector!, passage.vector),
    }))
    .filter((one) => one.distance <= floor)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, LOCAL_RETRIEVAL_LIMIT)
    .map((one) => one.passage);
}

/** As `eval-local-embedder.mts` counts one: the file too, because three
 * fixtures are searched as one pool, and a prefix, because a quote can straddle
 * a chunk boundary the answering passage still contains. */
const hit = (found: Passage[], expect: readonly Expectation[]) =>
  expect.some((one) =>
    found.some(
      (p) => p.file === one.file && p.text.includes(one.quote.slice(0, 40)),
    ),
  );

type Row = { asked: boolean; joined: boolean; standalone: boolean };

const rows: Row[] = [];

console.log(
  `${useFake ? "fake" : LOCAL_EMBEDDING_MODEL}: ${String(passages.length)} passages\n`,
);

for (const one of FOLLOW_UP_SET) {
  // One previous turn, as `lib/local/transport.ts` joins it — not the whole
  // context, which would measure a capability the product does not have.
  const joined = `${one.context.at(-1)!} ${one.followUp}`;

  const row = {
    asked: hit(await retrieved(one.followUp), one.expect),
    joined: hit(await retrieved(joined), one.expect),
    standalone: hit(await retrieved(one.standalone), one.expect),
  };

  rows.push(row);
  console.log(
    `  ${row.asked ? "o" : "·"}${row.joined ? "o" : "·"}${row.standalone ? "o" : "·"}  ${one.followUp}`,
  );
}

const share = (of: (row: Row) => boolean) =>
  `${String(rows.filter(of).length)}/${String(rows.length)}`;

console.log(
  `\nas asked: ${share((r) => r.asked)}` +
    `  joined: ${share((r) => r.joined)}` +
    `  standalone: ${share((r) => r.standalone)}`,
);
