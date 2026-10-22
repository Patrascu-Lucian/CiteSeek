/** `eval-retrieval.mts` calls the model only for the rewrite, so which
 * unanswerable questions clear the floor is measured and what happens to them is
 * not. Scored on rule 4 of the prompt — never attach a marker to a refusal —
 * rather than a regex over refusal wording, which would measure the regex. The
 * model gets the chat route's tools and step limit, from the same module.
 *
 * Usage: pnpm eval:refusals [--rule7=candidate] */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";
import { namesHost } from "../lib/env/named-host.ts";
import { ADJACENT_SET, GOLDEN_SET, UNCOVERED_SET } from "../eval/golden-set.ts";

const FLAGS = ["--rule7="];

/* A misspelled flag is silently the default, and the default writes the
   committed report. */
const unknown = process.argv
  .slice(2)
  .filter((one) => one.startsWith("--"))
  .find((one) => !FLAGS.some((flag) => one.startsWith(flag)));
if (unknown) {
  throw new Error(`Unknown flag ${unknown}. Known: ${FLAGS.join(" ")}`);
}

const rule7 = process.argv
  .find((one) => one.startsWith("--rule7="))
  ?.slice("--rule7=".length);
if (rule7 !== undefined && rule7 !== "candidate") {
  throw new Error(`--rule7 takes only "candidate", got "${rule7}".`);
}

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
const { createQueuedDocument, findDocumentInWorkspace } =
  await import("../lib/documents/queries.ts");
const { processDocument } = await import("../lib/rag/ingest.ts");
const { retrieveChunks } = await import("../lib/rag/retrieve.ts");
const { buildSources, buildSystemPrompt } = await import("../lib/ai/prompt.ts");
const { getChatModel } = await import("../lib/ai/provider.ts");
const { markerVerdict, opensWithRefusal, unresolvedMarkers } =
  await import("../lib/ai/citations.ts");
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
const HANDBOOK = join(
  EVAL_DIR,
  "..",
  "lib",
  "db",
  "fixtures",
  "northwind-remote-work-handbook.pdf",
);

/** Reported apart: the uncovered set samples the questions the floor finds
 * hardest, so pooling it with the golden set's would describe neither. The
 * adjacent set is asked of the handbook alone, as a guest's demo holds it. */
const SETS: {
  name: string;
  corpus: "fixtures" | "handbook";
  questions: string[];
}[] = [
  {
    name: "golden",
    corpus: "fixtures",
    // `expect: []` is the golden set's marker for unanswerable.
    questions: GOLDEN_SET.filter((one) => one.expect.length === 0).map(
      (one) => one.question,
    ),
  },
  {
    name: "uncovered",
    corpus: "fixtures",
    questions: UNCOVERED_SET.map((one) => one.question),
  },
  {
    name: "adjacent",
    corpus: "handbook",
    questions: ADJACENT_SET.map((one) => one.question),
  },
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

const created: string[] = [];

async function scratchWorkspace(): Promise<string> {
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `refusals ${new Date().toISOString()}`, ownerId: null })
    .returning({ id: workspaces.id });
  created.push(workspace!.id);
  return workspace!.id;
}

async function ingest(workspaceId: string, path: string, mimeType: string) {
  const bytes = new Uint8Array(await readFile(path));
  const filename = path.split(/[\\/]/).pop()!;
  const document = await createQueuedDocument(workspaceId, {
    filename,
    mimeType,
    sizeBytes: bytes.length,
  });
  await processDocument(workspaceId, document.id, bytes, mimeType);

  // `processDocument` records a failure on the row rather than throwing, and a
  // failed document reads as every question refused by the floor.
  const stored = await findDocumentInWorkspace(workspaceId, document.id);
  if (stored?.status !== "ready") {
    throw new Error(`${filename} did not ingest: ${String(stored?.error)}`);
  }
  console.log(`  ingested ${filename}`);
}

try {
  const workspaceFor = {
    fixtures: await scratchWorkspace(),
    handbook: await scratchWorkspace(),
  };
  for (const file of FILES) {
    await ingest(workspaceFor.fixtures, join(FIXTURES, file), "text/markdown");
  }
  await ingest(workspaceFor.handbook, HANDBOOK, "application/pdf");

  // Retrieval is deterministic, so the floor is settled once and the runs below
  // differ only in what the model said.
  const reaching: {
    set: string;
    question: string;
    workspaceId: string;
    sources: ChatSource[];
  }[] = [];

  for (const { name, corpus, questions } of SETS) {
    const workspaceId = workspaceFor[corpus];
    for (const question of questions) {
      const { chunks } = await retrieveChunks(workspaceId, question);
      if (chunks.length > 0) {
        reaching.push({
          set: name,
          question,
          workspaceId,
          sources: buildSources(chunks),
        });
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
    linked: boolean;
    passages: number;
    outOfRange: number[];
    opensDeclining: boolean;
  }[] = [];
  const rates = new Map(SETS.map(({ name }) => [name, [] as number[]]));
  // What the page does with those markers (ADR 058), read through the same
  // function the page calls, so the two cannot be measured apart.
  const linkedRates = new Map(SETS.map(({ name }) => [name, [] as number[]]));
  const unlinkedRates = new Map(SETS.map(({ name }) => [name, [] as number[]]));
  const outOfRangeRates = new Map(
    SETS.map(({ name }) => [name, [] as number[]]),
  );
  // What a wording change has to keep: every reply here is a refusal, so one
  // that stops opening in a form the page reads is read for what it did.
  const openingRates = new Map(SETS.map(({ name }) => [name, [] as number[]]));

  for (let run = 1; run <= RUNS; run += 1) {
    const cited = new Map(SETS.map(({ name }) => [name, 0]));
    const linkedCount = new Map(SETS.map(({ name }) => [name, 0]));
    const unlinkedCount = new Map(SETS.map(({ name }) => [name, 0]));
    const outOfRangeCount = new Map(SETS.map(({ name }) => [name, 0]));
    const openingCount = new Map(SETS.map(({ name }) => [name, 0]));

    for (const { set, question, workspaceId, sources } of reaching) {
      const { text } = await generateText({
        model: getChatModel(),
        system: buildSystemPrompt(sources, true, rule7 ?? "shipped"),
        prompt: question,
        tools: chatTools(workspaceId),
        stopWhen: CHAT_STEP_LIMIT,
      });

      // All three columns read markers with the page's grammar: `cites` takes
      // only a single in-range `[n]`, so `[1, 2]` or an invented `[9]` would
      // count as unlinked without counting as carried.
      const verdict = markerVerdict(text, sources);
      const marked =
        verdict.declined ||
        verdict.linked.length > 0 ||
        verdict.invented.length > 0;
      if (marked) cited.set(set, (cited.get(set) ?? 0) + 1);

      const linked = verdict.linked.length > 0;
      if (linked) linkedCount.set(set, (linkedCount.get(set) ?? 0) + 1);
      if (verdict.declined) {
        unlinkedCount.set(set, (unlinkedCount.get(set) ?? 0) + 1);
      }

      // Not from the verdict, which reports none for a declining reply (one
      // note per reply), so a refusal's invented `[9]` would go uncounted.
      const outOfRange = unresolvedMarkers(text, sources);
      if (outOfRange.length > 0) {
        outOfRangeCount.set(set, (outOfRangeCount.get(set) ?? 0) + 1);
      }

      const opensDeclining = opensWithRefusal(text);
      if (opensDeclining) {
        openingCount.set(set, (openingCount.get(set) ?? 0) + 1);
      }

      answers.push({
        run,
        set,
        question,
        text: text.trim(),
        cited: marked,
        linked,
        passages: sources.length,
        outOfRange,
        opensDeclining,
      });
    }

    for (const [set, count] of cited) rates.get(set)?.push(count);
    for (const [set, count] of linkedCount) linkedRates.get(set)?.push(count);
    for (const [set, count] of unlinkedCount) {
      unlinkedRates.get(set)?.push(count);
    }
    for (const [set, count] of outOfRangeCount) {
      outOfRangeRates.get(set)?.push(count);
    }
    for (const [set, count] of openingCount) {
      openingRates.get(set)?.push(count);
    }
    console.log(
      `  run ${String(run)}: ${[...cited].map(([set, count]) => `${String(count)} of ${String(clearing(set))} ${set}`).join(", ")} carried a marker`,
    );
  }

  const report = [
    "# What the model does with the questions the floor lets through",
    "",
    "Three sets of unanswerable questions. The golden set's are the ones its floor",
    "table counts. Each uncovered question names something one document is about",
    "and asks for a detail it does not cover, so that set samples the hard region",
    "on purpose and its rate is not the product's. The adjacent set has the same",
    "shape, asked of the demo handbook alone, as a guest's workspace holds it.",
    ...(rule7
      ? [
          "",
          "Asked with rule 7 + the earlier-turns sentence (ADR 061), the wording",
          "measured against the shipped one before it may replace it.",
        ]
      : []),
    "",
    "| set | clear the shipped floor | carrying a marker | rendered as a link | unlinked by its form | carrying an out-of-range marker | opens in a declining form the page recognizes |",
    "| --- | ----------------------- | ----------------- | ------------------ | -------------------- | ------------------------------- | --------------------------------------------- |",
    ...SETS.map(({ name, questions }) => {
      const per = (counts: Map<string, number[]>) =>
        `${(counts.get(name) ?? []).join(", ")} of ${String(clearing(name))}`;

      return `| ${name} | ${String(clearing(name))} of ${String(questions.length)} | ${per(rates)} | ${per(linkedRates)} | ${per(unlinkedRates)} | ${per(outOfRangeRates)} | ${per(openingRates)} |`;
    }),
    "",
    "Per run, every column reading markers as the page does. A reply that opens",
    "in a declining form the page recognizes links none of its markers (ADR 058),",
    'so "rendered as a link" is what a reader can still click on a refusal:',
    "replies that declined in a wording the page does not recognize. Whether an",
    "unlinked marker pointed at something relevant is read from the answers",
    "below, not counted here.",
    "",
    "The last column is the one that does not read as the page does: a marker",
    "naming no passage the reply was given, counted on every reply whatever its",
    "form. The page folds one in a declining reply into that reply's single",
    "note, so its own reading would show none.",
    "",
    "The opening column counts replies the page reads as declining whether or",
    "not they carry a marker. Every question here is unanswerable, so a reply",
    "outside it is read below for whether it declined in other words.",
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
      `Linked on the page: ${String(one.linked)}`,
      `Passages: ${String(one.passages)}`,
      `Out of range: ${one.outOfRange.length === 0 ? "none" : one.outOfRange.map((marker) => `[${String(marker)}]`).join(", ")}`,
      `Opens in a declining form the page recognizes: ${String(one.opensDeclining)}`,
      "",
      one.text,
      "",
    ]),
  ].join("\n");

  // Never over the committed report: that one is the shipped wording's.
  const file = rule7 ? "refusals-rule7-candidate.md" : "refusals.md";
  await writeFile(join(EVAL_DIR, file), report);
  console.log(`\nWrote eval/${file}`);
} finally {
  const { eq } = await import("drizzle-orm");
  for (const id of created) {
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }
}
