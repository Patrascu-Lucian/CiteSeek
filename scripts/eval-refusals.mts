/** `eval-retrieval.mts` calls the model only for the rewrite, so which
 * unanswerable questions clear the floor is measured and what happens to them is
 * not. Scored on rule 4 of the prompt — never attach a marker to a refusal —
 * rather than a regex over refusal wording, which would measure the regex. The
 * model gets the chat route's tools and step limit, from the same module. */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";
import { namesHost } from "../lib/env/named-host.ts";
import { GOLDEN_SET, UNCOVERED_SET } from "../eval/golden-set.ts";
import { cites } from "../eval/scoring.ts";

// Read before `loadLocalEnv`: `.env.local` must not be what decides to spend
// money, or which database to write to.
const exportedChatProvider = process.env.CHAT_PROVIDER;
const confirmedHost = process.env.EVAL_HOST;

loadLocalEnv();

if (exportedChatProvider?.trim().toLowerCase() !== "google") {
  throw new Error(
    "Export CHAT_PROVIDER=google. The fake model returns a fixture, which would " +
      "score the fixture rather than the prompt.",
  );
}

/* The floor is calibrated per embedding model, so under a different one
   "reached the model" names a different set of questions. Read after the load,
   unlike the two above: it checks what the run embeds with, not who chose. */
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
const named = namesHost(confirmedHost, hostname);

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
const { CHAT_STEP_LIMIT, chatTools } = await import("../lib/chats/tools.ts");

type ChatSource = ReturnType<typeof buildSources>[number];

const EVAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "eval");
const FIXTURES = join(EVAL_DIR, "fixtures");
const FILES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

/** Reported apart: the uncovered set samples the questions the floor finds
 * hardest, so pooling it with the golden set's would describe neither. */
const SETS = [
  {
    name: "golden",
    // `expect: []` is the golden set's marker for unanswerable.
    questions: GOLDEN_SET.filter((one) => one.expect.length === 0).map(
      (one) => one.question,
    ),
  },
  { name: "uncovered", questions: UNCOVERED_SET.map((one) => one.question) },
];

/* More than one, because one is not evidence here: the same question drew a
   citation in some runs and not others, which is the finding rather than noise
   around it. */
const RUNS = Number(process.env.REFUSAL_RUNS ?? 3);
if (!Number.isInteger(RUNS) || RUNS < 1) {
  throw new Error(
    `REFUSAL_RUNS must be a whole number of at least 1, not "${String(process.env.REFUSAL_RUNS)}". ` +
      "A zero-run report reads like a measurement and is not one.",
  );
}

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
  const reaching: { set: string; question: string; sources: ChatSource[] }[] =
    [];

  for (const { name, questions } of SETS) {
    for (const question of questions) {
      const { chunks } = await retrieveChunks(workspaceId, question);
      if (chunks.length > 0) {
        reaching.push({ set: name, question, sources: buildSources(chunks) });
      }
    }
  }

  const clearing = (set: string) =>
    reaching.filter((one) => one.set === set).length;

  console.log(
    `\nClear the floor: ${SETS.map(({ name, questions }) => `${String(clearing(name))} of ${String(questions.length)} ${name}`).join(", ")}.\n`,
  );

  const answers: {
    run: number;
    set: string;
    question: string;
    text: string;
    cited: boolean;
  }[] = [];
  const rates = new Map(SETS.map(({ name }) => [name, [] as number[]]));

  for (let run = 1; run <= RUNS; run += 1) {
    const cited = new Map(SETS.map(({ name }) => [name, 0]));

    for (const { set, question, sources } of reaching) {
      const { text } = await generateText({
        model: getChatModel(),
        system: buildSystemPrompt(sources),
        prompt: question,
        tools: chatTools(workspaceId),
        stopWhen: CHAT_STEP_LIMIT,
      });

      const marked = cites(text, sources.length);
      if (marked) cited.set(set, (cited.get(set) ?? 0) + 1);
      answers.push({ run, set, question, text: text.trim(), cited: marked });
    }

    for (const [set, count] of cited) rates.get(set)?.push(count);
    console.log(
      `  run ${String(run)}: ${[...cited].map(([set, count]) => `${String(count)} of ${String(clearing(set))} ${set}`).join(", ")} carried a marker`,
    );
  }

  const report = [
    "# What the model does with the questions the floor lets through",
    "",
    "Two sets of unanswerable questions. The golden set's are the ones its floor",
    "table counts. Each uncovered question names something one document is about",
    "and asks for a detail it does not cover, so that set samples the hard region",
    "on purpose and its rate is not the product's.",
    "",
    "| set | clear the shipped floor | replies carrying a marker, per run |",
    "| --- | ----------------------- | ---------------------------------- |",
    ...SETS.map(
      ({ name, questions }) =>
        `| ${name} | ${String(clearing(name))} of ${String(questions.length)} | ${(rates.get(name) ?? []).join(", ")} of ${String(clearing(name))} |`,
    ),
    "",
    "Rule 4 of the system prompt forbids attaching a marker to a refusal, so a",
    "marker on a refusal is the prompt broken by its own definition. Answers are",
    "verbatim, because whether a reply refused at all is read rather than",
    "matched: a regex over refusal wording would measure the regex. The model",
    "runs with the chat route's tools and step limit.",
    "",
    ...answers.flatMap((one) => [
      `## Run ${String(one.run)} — ${one.set} — ${one.question}`,
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
