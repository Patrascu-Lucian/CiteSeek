/** `eval-retrieval.mts` calls the model only for the rewrite, so which
 * unanswerable questions clear the floor is measured and what happens to them is
 * not. Scored on rule 4 of the prompt — never attach a marker to a refusal —
 * than a regex over refusal wording, which would measure the regex. */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";
import { GOLDEN_SET } from "../eval/golden-set.ts";
import { cites } from "../eval/scoring.ts";

loadLocalEnv();

if (process.env.CHAT_PROVIDER?.trim().toLowerCase() !== "google") {
  throw new Error(
    "Export CHAT_PROVIDER=google. The fake model returns a fixture, which would " +
      "score the fixture rather than the prompt.",
  );
}

/* The floor is calibrated per embedding model, so under a different one
   "reached the model" names a different set of questions. */
const embeddings = process.env.EMBEDDINGS_PROVIDER?.trim().toLowerCase();
if (embeddings && embeddings !== "google") {
  throw new Error(
    "This measures which questions clear the shipped floor, and the floor is " +
      "calibrated per embedding model. Unset EMBEDDINGS_PROVIDER, or set it to google.",
  );
}

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
process.env.DATABASE_URL = connectionString;

const hostname = new URL(connectionString).hostname;
const LOCAL = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal)$/;

/* `eval-retrieval`'s guard: this writes documents and spends quota, so it must
   not reach a database nobody named. */
const named =
  process.env.EVAL_HOST !== undefined &&
  hostname.includes(process.env.EVAL_HOST);

if (!LOCAL.test(hostname) && !named) {
  throw new Error(
    `Refusing to run against ${hostname}. Name it: EVAL_HOST=${hostname.split(".")[0]}`,
  );
}

console.log(`Evaluating against ${hostname}\n`);

const { db } = await import("../lib/db/index.ts");
const { workspaces } = await import("../lib/db/schema.ts");
const { createQueuedDocument } = await import("../lib/documents/queries.ts");
const { processDocument } = await import("../lib/rag/ingest.ts");
const { retrieveChunks } = await import("../lib/rag/retrieve.ts");
const { buildSources, buildSystemPrompt } = await import("../lib/ai/prompt.ts");
const { getChatModel } = await import("../lib/ai/provider.ts");
const { generateText } = await import("ai");

type ChatSource = ReturnType<typeof buildSources>[number];

const EVAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "eval");
const FIXTURES = join(EVAL_DIR, "fixtures");
const FILES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

/** `expect: []` is the golden set's marker for unanswerable. */
const UNANSWERABLE = GOLDEN_SET.filter((one) => one.expect.length === 0);

/* More than one, because one is not evidence here: the same question drew a
   citation in some runs and not others, which is the finding rather than noise
   around it. */
const RUNS = Number(process.env.REFUSAL_RUNS ?? 3);

const [workspace] = await db
  .insert(workspaces)
  .values({ name: `refusals ${new Date().toISOString()}`, ownerId: null })
  .returning({ id: workspaces.id });

const workspaceId = workspace!.id;

try {
  for (const file of FILES) {
    const bytes = new Uint8Array(await readFile(join(FIXTURES, file)));
    const document = await createQueuedDocument(workspaceId, {
      filename: file,
      mimeType: "text/markdown",
      sizeBytes: bytes.length,
    });
    await processDocument(workspaceId, document.id, bytes, "text/markdown");
    console.log(`  ingested ${file}`);
  }

  // Retrieval is deterministic, so the floor is settled once and the runs below
  // differ only in what the model said.
  const reaching: { question: string; sources: ChatSource[] }[] = [];

  for (const { question } of UNANSWERABLE) {
    const { chunks } = await retrieveChunks(workspaceId, question);
    if (chunks.length > 0) {
      reaching.push({ question, sources: buildSources(chunks) });
    }
  }

  console.log(
    `\n${String(reaching.length)} of ${String(UNANSWERABLE.length)} unanswerable questions clear the floor.\n`,
  );

  const answers: {
    run: number;
    question: string;
    text: string;
    cited: boolean;
  }[] = [];
  const rates: number[] = [];

  for (let run = 1; run <= RUNS; run += 1) {
    let cited = 0;

    for (const { question, sources } of reaching) {
      const { text } = await generateText({
        model: getChatModel(),
        system: buildSystemPrompt(sources),
        prompt: question,
      });

      const marked = cites(text, sources.length);
      if (marked) cited += 1;
      answers.push({ run, question, text: text.trim(), cited: marked });
    }

    rates.push(cited);
    console.log(
      `  run ${String(run)}: ${String(cited)} of ${String(reaching.length)} cited a passage`,
    );
  }

  const report = [
    "# What the model does with the questions the floor lets through",
    "",
    `${String(reaching.length)} of ${String(UNANSWERABLE.length)} unanswerable questions clear the shipped floor and reach the model.`,
    `Citations on a refusal, per run: ${rates.join(", ")} of ${String(reaching.length)}.`,
    "",
    "Rule 4 of the system prompt forbids attaching a marker to a refusal, so a",
    "marker here is the prompt broken by its own definition. Answers are verbatim:",
    "a regex over refusal wording would measure the regex.",
    "",
    ...answers.flatMap((one) => [
      `## Run ${String(one.run)} — ${one.question}`,
      "",
      `Cited: ${String(one.cited)}`,
      "",
      one.text,
      "",
    ]),
  ].join("\n");

  await writeFile(join(EVAL_DIR, "refusals.md"), report);
  console.log("\nWrote eval/refusals.md");
} finally {
  const { eq } = await import("drizzle-orm");
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}
