/** What Gemini answers to questions the documents can answer, at each passage
 * count or chunk size. Retrieval, prompt and generation are the chat route's
 * own, so a change this decides is a change to what ships (ADR 059).
 *
 * Usage: pnpm eval:answers [--fake] [--counts=3,8] [--chunk=400,600,800]
 *        pnpm eval:answers --conversation [--rule7=candidate] [--fake]
 */
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";
import { namesHost } from "../lib/env/named-host.ts";
import {
  ANSWER_SET,
  CONVERSATION_SEQUENCES,
  CONVERSATION_SET,
  FOLLOW_UP_SET,
  type Expectation,
} from "../eval/golden-set.ts";
import { grounds } from "../eval/scoring.ts";
import type { Rule7 } from "../lib/ai/prompt.ts";
import {
  REFUSAL_PART_ID,
  SOURCES_PART_ID,
  type ChatUIMessage,
} from "../lib/ai/types.ts";
import type { ChunkSizes } from "../lib/rag/chunking.ts";
import type { Paired, Span } from "../lib/rag/eval-metrics.ts";

const FLAGS = ["--fake", "--counts=", "--chunk=", "--conversation", "--rule7="];

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

const conversation = process.argv.includes("--conversation");
const rule7 = process.argv
  .find((one) => one.startsWith("--rule7="))
  ?.slice("--rule7=".length);
if (rule7 !== undefined && rule7 !== "candidate") {
  throw new Error(`--rule7 takes only "candidate", got "${rule7}".`);
}
if (rule7 && !conversation) {
  throw new Error("--rule7=candidate is measured with --conversation.");
}
if (conversation && (listFlag("--counts=") || listFlag("--chunk="))) {
  throw new Error(
    "--conversation runs at the shipped count and size: drop --counts= and --chunk=.",
  );
}
// The shipped wording alone is a measurement with no verdict.
const ARMS: readonly Rule7[] = rule7 ? ["shipped", "candidate"] : ["shipped"];

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
const { NO_RELEVANT_PASSAGES_REPLY, buildSources, buildSystemPrompt } =
  await import("../lib/ai/prompt.ts");
const { getChatModel } = await import("../lib/ai/provider.ts");
const { rewriteQuestion } = await import("../lib/ai/rewrite.ts");
const { markerVerdict, opensWithRefusal } =
  await import("../lib/ai/citations.ts");
const { CHAT_STEP_LIMIT, chatTools } = await import("../lib/chats/tools.ts");
const { citesExpected, comparePaired, decideDefault, isAnswering, majority } =
  await import("../lib/rag/eval-metrics.ts");
const { convertToModelMessages, generateText } = await import("ai");

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
/** The demo's own document, asked alone as a guest's workspace holds it. */
const HANDBOOK = join(
  EVAL_DIR,
  "..",
  "lib",
  "db",
  "fixtures",
  "northwind-remote-work-handbook.pdf",
);

type Scored = {
  text: string;
  grounded: boolean;
  cites: boolean;
  declined: boolean;
  /** A right answer the page unlinks: grounded, opening in a declining form,
   * and carrying markers. */
  readAsRefusal: boolean;
  inputTokens: number;
};

/** What the route sends when the floor refuses: no model call. */
const REFUSED: Scored = {
  text: "(refused by the floor)",
  grounded: false,
  cites: false,
  declined: true,
  readAsRefusal: false,
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

/** A workspace of its own for `run`, deleted whatever `run` does. */
async function withWorkspace<T>(
  name: string,
  run: (workspaceId: string) => Promise<T>,
): Promise<T> {
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `${name} ${new Date().toISOString()}`, ownerId: null })
    .returning({ id: workspaces.id });

  try {
    // Awaited: without it `finally` empties the workspace mid-run, and every
    // question then scores as refused by the floor, with no error.
    return await run(workspace!.id);
  } finally {
    await db.delete(workspaces).where(eq(workspaces.id, workspace!.id));
  }
}

/** Through the shipped pipeline, and only a `ready` document comes back. */
async function ingestDocument(
  workspaceId: string,
  path: string,
  mimeType: string,
  chunkSizes?: ChunkSizes,
) {
  const bytes = new Uint8Array(await readFile(path));
  const filename = basename(path);
  const document = await createQueuedDocument(workspaceId, {
    filename,
    mimeType,
    sizeBytes: bytes.length,
  });
  await processDocument(workspaceId, document.id, bytes, mimeType, {
    chunkSizes,
  });
  const stored = await findDocumentInWorkspace(workspaceId, document.id);
  // `processDocument` records a failure on the row rather than throwing, and
  // a failed document reads as its questions missed by retrieval.
  if (stored?.status !== "ready") {
    throw new Error(`${filename} did not ingest: ${String(stored?.error)}`);
  }
  return { id: document.id, contentText: stored.contentText ?? "" };
}

/** Ingests the fixtures at `sizes` into a workspace of its own and hands it to
 * `run`. */
async function withCorpus<T>(
  sizes: ChunkSizes | undefined,
  run: (corpus: Corpus) => Promise<T>,
): Promise<T> {
  return withWorkspace("answers", async (workspaceId) => {
    const textByFile = new Map<string, string>();
    const idByFile = new Map<string, string>();

    for (const file of FILES) {
      const document = await ingestDocument(
        workspaceId,
        join(FIXTURES, file),
        "text/markdown",
        sizes,
      );
      // Offsets index the stored text, which normalization has already rewritten.
      textByFile.set(file, document.contentText);
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

    return run({
      workspaceId,
      stored,
      spansFor,
      spans,
      filenameOf: (documentId) =>
        [...idByFile].find(([, id]) => id === documentId)![0],
    });
  });
}

/** One scorer for both modes, so the alone and conversation reports cannot
 * disagree about what a reply did. */
function scoreReply(
  text: string,
  sources: ChatSource[],
  index: number,
  { spans, stored }: Corpus,
  inputTokens: number,
): Scored {
  const verdict = markerVerdict(text, sources);
  const grounded = grounds(text, ANSWER_SET[index]!.answerContains);
  return {
    text: text.trim(),
    grounded,
    cites: citesExpected(verdict.linked, sources, spans[index]!, stored),
    declined: opensWithRefusal(text),
    readAsRefusal: grounded && verdict.declined,
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

const CONDITIONS = ["alone", "topic change", "same topic"] as const;
type Condition = (typeof CONDITIONS)[number];

type Asked = {
  /** Answered once, with the shipped wording, and the history both arms share.
   * Absent when asked alone. */
  first?: { question: string; text: string };
  /** Topic change only: a passage from the earlier turn's document came back. */
  earlierInView: boolean;
  replies: Partial<Record<Rule7, Scored>>;
};

/** No expected value to ground against, so citing and declining only. */
type FollowReply = { text: string; cites: boolean; declined: boolean };

type FollowedUp = {
  /** The context turns, answered once with the shipped wording. */
  earlier: { question: string; text: string }[];
  /** The route's rewrite, when the follow-up alone retrieved nothing. */
  searchedFor: string | null;
  replies: Partial<Record<Rule7, FollowReply>>;
};

type SequenceReply = {
  text: string;
  /** Opens declining with markers, so the page links none of them. */
  unlinked: boolean;
  /** Null on the handbook, where nothing says what the right answer is. */
  readAsRefusal: boolean | null;
};

type Sequenced = {
  /** Answered once, with the shipped wording; each wording goes on from it. */
  first: { question: string; text: string };
  turns: {
    question: string;
    replies: Partial<Record<Rule7, SequenceReply>>;
  }[];
};

type Conversed = Record<Condition, { ask: string; runs: Asked[] }[]> & {
  followUps: { ask: string; runs: FollowedUp[] }[];
  sequences: {
    name: string;
    corpus: "fixtures" | "handbook";
    runs: Sequenced[];
  }[];
};

// By text, not status: once the candidate ships, "shipped" names the other one.
const ARM_LABELS: Record<Rule7, string> = {
  shipped: "rule 7 as of v1.11.0",
  candidate: "rule 7 + the earlier-turns sentence (ADR 061)",
};

async function converse(handbookId: string): Promise<Conversed> {
  return withCorpus(undefined, async (corpus) => {
    const index = new Map(ANSWER_SET.map((one, at) => [one.question, at]));
    const at = (question: string) => index.get(question)!;

    const user = (text: string): ChatUIMessage => ({
      id: randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
    });
    const assistant = (sources: ChatSource[], text: string): ChatUIMessage => ({
      id: randomUUID(),
      role: "assistant",
      parts: [
        sources.length === 0
          ? {
              type: "data-refusal",
              id: REFUSAL_PART_ID,
              data: { reason: "no_relevant_passages" },
            }
          : { type: "data-sources", id: SOURCES_PART_ID, data: sources },
        { type: "text", text },
      ],
    });

    // The chat route's order (`route.ts`): retrieve, and only when nothing clears
    // the floor, rewrite from the history and retrieve once more.
    const sourcesFor = async (
      ui: ChatUIMessage[],
      question: string,
      workspaceId = corpus.workspaceId,
    ): Promise<{ sources: ChatSource[]; searchedFor: string | null }> => {
      const found = await retrieveChunks(workspaceId, question);
      if (found.chunks.length > 0) {
        return { sources: buildSources(found.chunks), searchedFor: null };
      }
      const rewritten = await rewriteQuestion(ui, question);
      if (!rewritten) return { sources: [], searchedFor: null };
      const again = await retrieveChunks(workspaceId, rewritten.question);
      return {
        sources: buildSources(again.chunks),
        searchedFor: again.chunks.length > 0 ? rewritten.question : null,
      };
    };

    const generate = async (
      ui: ChatUIMessage[],
      sources: ChatSource[],
      arm: Rule7,
      workspaceId = corpus.workspaceId,
    ) => {
      const { text, usage } = await generateText({
        model: getChatModel(),
        system: buildSystemPrompt(sources, true, arm),
        messages: await convertToModelMessages(ui),
        tools: chatTools(workspaceId),
        stopWhen: CHAT_STEP_LIMIT,
      });
      return { text, inputTokens: usage.inputTokens ?? 0 };
    };

    /** Answers `question` once, with the shipped wording, as the next turn of
     * `history`, and appends both turns to it. */
    const earlierTurn = async (
      history: ChatUIMessage[],
      question: string,
      workspaceId = corpus.workspaceId,
    ) => {
      const ui = [...history, user(question)];
      const { sources } = await sourcesFor(ui, question, workspaceId);
      const text =
        sources.length === 0
          ? NO_RELEVANT_PASSAGES_REPLY
          : (await generate(ui, sources, "shipped", workspaceId)).text;
      history.push(ui.at(-1)!, assistant(sources, text));
      return { question, text: text.trim() };
    };

    // Before the first paid call, like `ANSWER_SET`'s.
    const followUpSpans = FOLLOW_UP_SET.map((one) =>
      corpus.spansFor(one.expect),
    );

    const result = {
      ...Object.fromEntries(
        CONDITIONS.map((condition) => [
          condition,
          CONVERSATION_SET.map(({ ask }) => ({ ask, runs: [] as Asked[] })),
        ]),
      ),
      followUps: FOLLOW_UP_SET.map(({ followUp }) => ({
        ask: followUp,
        runs: [] as FollowedUp[],
      })),
      sequences: CONVERSATION_SEQUENCES.map(({ name, corpus }) => ({
        name,
        corpus,
        runs: [] as Sequenced[],
      })),
    } as Conversed;

    // Run, then question, then condition, then arm: drift during the session
    // lands on both arms alike.
    for (let run = 0; run < RUNS; run += 1) {
      for (const [position, one] of CONVERSATION_SET.entries()) {
        for (const condition of CONDITIONS) {
          const earlier =
            condition === "alone"
              ? null
              : condition === "topic change"
                ? one.afterTopicChange
                : one.afterSameTopic;
          const history: ChatUIMessage[] = [];
          const first = earlier
            ? await earlierTurn(history, earlier)
            : undefined;

          const ui = [...history, user(one.ask)];
          const { sources } = await sourcesFor(ui, one.ask);
          const replies: Asked["replies"] = {};
          for (const arm of ARMS) {
            if (sources.length === 0) {
              replies[arm] = REFUSED;
              continue;
            }
            const { text, inputTokens } = await generate(ui, sources, arm);
            replies[arm] = scoreReply(
              text,
              sources,
              at(one.ask),
              corpus,
              inputTokens,
            );
          }

          const earlierDocument =
            condition === "topic change" && earlier
              ? corpus.spans[at(earlier)]![0]!.documentId
              : null;
          result[condition][position]!.runs.push({
            first,
            earlierInView: sources.some(
              (source) => source.documentId === earlierDocument,
            ),
            replies,
          });
        }
      }

      for (const [position, one] of FOLLOW_UP_SET.entries()) {
        const history: ChatUIMessage[] = [];
        const earlier = [];
        for (const turn of one.context) {
          earlier.push(await earlierTurn(history, turn));
        }

        const ui = [...history, user(one.followUp)];
        const { sources, searchedFor } = await sourcesFor(ui, one.followUp);
        const replies: FollowedUp["replies"] = {};
        for (const arm of ARMS) {
          if (sources.length === 0) {
            replies[arm] = { text: REFUSED.text, cites: false, declined: true };
            continue;
          }
          const { text } = await generate(ui, sources, arm);
          replies[arm] = {
            text: text.trim(),
            cites: citesExpected(
              markerVerdict(text, sources).linked,
              sources,
              followUpSpans[position]!,
              corpus.stored,
            ),
            declined: opensWithRefusal(text),
          };
        }
        result.followUps[position]!.runs.push({
          earlier,
          searchedFor,
          replies,
        });
      }

      for (const [position, sequence] of CONVERSATION_SEQUENCES.entries()) {
        const onFixtures = sequence.corpus === "fixtures";
        const workspaceId = onFixtures ? corpus.workspaceId : handbookId;
        const shared: ChatUIMessage[] = [];
        const first = await earlierTurn(
          shared,
          sequence.turns[0]!,
          workspaceId,
        );
        const histories = new Map(ARMS.map((arm) => [arm, [...shared]]));
        const turns: Sequenced["turns"] = [];

        for (const question of sequence.turns.slice(1)) {
          const replies: Sequenced["turns"][number]["replies"] = {};
          for (const arm of ARMS) {
            const history = histories.get(arm)!;
            const ui = [...history, user(question)];
            const { sources } = await sourcesFor(ui, question, workspaceId);
            const refused = sources.length === 0;
            const text = refused
              ? NO_RELEVANT_PASSAGES_REPLY
              : (await generate(ui, sources, arm, workspaceId)).text;
            history.push(ui.at(-1)!, assistant(sources, text));
            replies[arm] = {
              text: refused ? REFUSED.text : text.trim(),
              unlinked: markerVerdict(text, sources).declined,
              readAsRefusal: onFixtures
                ? !refused &&
                  scoreReply(text, sources, at(question), corpus, 0)
                    .readAsRefusal
                : null,
            };
          }
          turns.push({ question, replies });
        }
        result.sequences[position]!.runs.push({ first, turns });
      }

      console.log(`  run ${String(run + 1)} of ${String(RUNS)} asked`);
    }

    return result;
  });
}

const OUTCOMES = [
  ["grounded", (one: Scored) => one.grounded],
  ["cites", (one: Scored) => one.cites],
  ["not read as a refusal", (one: Scored) => !one.readAsRefusal],
] as const;

const FOLLOW_UP_OUTCOMES = [
  ["cites", (one: FollowReply) => one.cites],
  ["not declined", (one: FollowReply) => !one.declined],
] as const;

type Rows<T> = {
  ask: string;
  runs: { replies: Partial<Record<Rule7, T>> }[];
}[];

const byQuestion = <T,>(rows: Rows<T>, arm: Rule7, test: (one: T) => boolean) =>
  new Map(
    rows.map(({ ask, runs }) => [
      ask,
      majority(runs.map((run) => test(run.replies[arm]!))),
    ]),
  );

const countHeld = <T,>(rows: Rows<T>, arm: Rule7, test: (one: T) => boolean) =>
  [...byQuestion(rows, arm, test).values()].filter(Boolean).length;

/** ADR 061's rule: no question worse on any outcome in any condition, and at
 * least one better. */
function conversationVerdict(result: Conversed) {
  const outcomes: Record<string, Paired> = {};
  const pair = <T,>(name: string, rows: Rows<T>, test: (one: T) => boolean) => {
    outcomes[name] = comparePaired(
      byQuestion(rows, "shipped", test),
      byQuestion(rows, "candidate", test),
    );
  };
  for (const condition of CONDITIONS) {
    for (const [name, test] of OUTCOMES) {
      pair(`${condition}: ${name}`, result[condition], test);
    }
  }
  for (const [name, test] of FOLLOW_UP_OUTCOMES) {
    pair(`follow-up: ${name}`, result.followUps, test);
  }
  return { outcomes, verdict: decideDefault(outcomes, 1) };
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

if (conversation) {
  const result = await withWorkspace("answers handbook", async (handbookId) => {
    await ingestDocument(handbookId, HANDBOOK, "application/pdf");
    return converse(handbookId);
  });
  const decided = rule7 ? conversationVerdict(result) : null;

  for (const condition of CONDITIONS) {
    for (const arm of ARMS) {
      const count = (test: (one: Scored) => boolean) =>
        String(countHeld(result[condition], arm, test));
      console.log(
        `  ${condition}, ${arm}: grounded ${count((one) => one.grounded)}/${String(CONVERSATION_SET.length)}, cites ${count((one) => one.cites)}, read as a refusal ${count((one) => one.readAsRefusal)}`,
      );
    }
  }
  for (const arm of ARMS) {
    const count = (test: (one: FollowReply) => boolean) =>
      String(countHeld(result.followUps, arm, test));
    console.log(
      `  follow-up, ${arm}: cites ${count((one) => one.cites)}/${String(FOLLOW_UP_SET.length)}, declined ${count((one) => one.declined)}`,
    );
  }
  for (const { name, runs } of result.sequences) {
    for (const arm of ARMS) {
      const replies = runs.flatMap(({ turns }) =>
        turns.map(({ replies }) => replies[arm]!),
      );
      console.log(
        `  ${name}, ${arm}: unlinked ${String(replies.filter((one) => one.unlinked).length)} of ${String(replies.length)} later turns`,
      );
    }
  }
  if (decided) console.log(`  candidate: ${decided.verdict}`);

  file = "answers-conversation.md";
  rendered = conversationReport(result, decided);
} else if (chunkTargets) {
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

function conversationReport(
  result: Conversed,
  decided: ReturnType<typeof conversationVerdict> | null,
): string {
  const total = CONVERSATION_SET.length;
  const tableRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const columns = CONDITIONS.flatMap((condition) =>
    ARMS.map((arm) => ({ condition, arm })),
  );
  const perRun = (condition: Condition, test: (one: Asked) => boolean) =>
    Array.from(
      { length: RUNS },
      (_, run) =>
        result[condition].filter(({ runs }) => test(runs[run]!)).length,
    ).join(", ");
  const majorityOf = (
    condition: Condition,
    arm: Rule7,
    test: (one: Scored) => boolean,
  ) => `${String(countHeld(result[condition], arm, test))}/${String(total)}`;
  const of = (arm: Rule7, test: (one: Scored) => boolean) => (asked: Asked) =>
    test(asked.replies[arm]!);
  const grounded = (one: Scored) => one.grounded;
  const cites = (one: Scored) => one.cites;
  const read = (one: Scored) => one.readAsRefusal;

  // Only replies with a value to check can be read as a refusal (ADR 061).
  const onFixtures = result.sequences.filter(
    (one) => one.corpus === "fixtures",
  );
  const gate = Array.from(
    { length: RUNS },
    (_, run) =>
      (["topic change", "same topic"] as const).reduce(
        (sum, condition) =>
          sum +
          result[condition].filter(({ runs }) =>
            read(runs[run]!.replies.shipped!),
          ).length,
        0,
      ) +
      onFixtures.reduce(
        (sum, { runs }) =>
          sum +
          runs[run]!.turns.filter(
            ({ replies }) => replies.shipped!.readAsRefusal,
          ).length,
        0,
      ),
  );
  const gateTotal =
    2 * total +
    onFixtures.reduce((sum, { runs }) => sum + runs[0]!.turns.length, 0);

  const followMajority = (arm: Rule7, test: (one: FollowReply) => boolean) =>
    `${String(countHeld(result.followUps, arm, test))}/${String(result.followUps.length)}`;
  const followPerRun = (arm: Rule7, test: (one: FollowReply) => boolean) =>
    Array.from(
      { length: RUNS },
      (_, run) =>
        result.followUps.filter(({ runs }) => test(runs[run]!.replies[arm]!))
          .length,
    ).join(", ");
  const quoted = ({ question, text }: { question: string; text: string }) => [
    `Earlier: ${question}`,
    "",
    `> ${text.replaceAll("\n", "\n> ")}`,
    "",
  ];

  const cell = (condition: Condition, arm: Rule7, position: number) => {
    const replies = result[condition][position]!.runs.map(
      (run) => run.replies[arm]!,
    );
    const most = (test: (one: Scored) => boolean) =>
      majority(replies.map(test));
    if (most(read)) return "**read as a refusal**";
    if (!most(grounded)) return "ungrounded";
    return most(cites) ? "yes" : "uncited";
  };

  return [
    "# What Gemini answers mid-conversation",
    "",
    `Run ${new Date().toISOString().slice(0, 10)} by \`pnpm eval:answers --conversation\`: each of the ${String(total)}`,
    "questions in `ANSWER_SET` asked second, after a turn about another document",
    "(topic change) and after one about the same document (same topic), and asked",
    "alone, all in one session. The earlier turn is answered once, with the shipped",
    "wording, and each wording answers the second turn on that same history. History",
    "goes through the chat route's `convertToModelMessages`, and retrieval follows",
    `its order, the rewrite included. ${String(RUNS)} runs; a question's result is the majority`,
    "of them.",
    "",
    "`read as a refusal` is a right answer the page unlinks: grounded, opening in a",
    "declining form, and carrying markers (ADR 058). The 1.11.0 exit check met one,",
    "the credit cap asked after the press. `earlier document in view` counts second",
    "turns that retrieved a passage from the earlier turn's document.",
    "",
    tableRow([
      "condition",
      "wording",
      "grounded",
      "grounded per run",
      "cites",
      "cites per run",
      "declined",
      "read as a refusal",
      "read as a refusal per run",
      "earlier document in view per run",
    ]),
    tableRow(Array<string>(10).fill("---")),
    ...columns.map(({ condition, arm }) =>
      tableRow([
        condition,
        ARM_LABELS[arm],
        majorityOf(condition, arm, grounded),
        perRun(condition, of(arm, grounded)),
        majorityOf(condition, arm, cites),
        perRun(condition, of(arm, cites)),
        majorityOf(condition, arm, (one) => one.declined),
        majorityOf(condition, arm, read),
        perRun(condition, of(arm, read)),
        condition === "topic change"
          ? perRun(condition, (asked) => asked.earlierInView)
          : "—",
      ]),
    ),
    "",
    "## The gate, by the rule committed before this run (ADR 061)",
    "",
    `${ARM_LABELS.shipped}, read as a refusal after a topic change or a same-topic`,
    `turn, or later in the exit check's sequence: ${gate.join(", ")} of ${String(gateTotal)} per run.`,
    "",
    ...(decided
      ? [
          "## The comparison, by the rule committed before this run (ADR 061)",
          "",
          "The earlier-turns sentence replaces the shipped wording only if no question",
          "gets worse on any outcome in any condition, and at least one gets better.",
          "",
          `**${decided.verdict}.**`,
          "",
          ...Object.entries(decided.outcomes).map(
            ([name, paired]) =>
              `- ${name}: gained ${list(paired.gained)}; lost ${list(paired.lost)}`,
          ),
          "",
        ]
      : []),
    "## Per question",
    "",
    tableRow([
      "question",
      ...columns.map(({ condition, arm }) => `${condition}, ${arm}`),
    ]),
    tableRow(["---", ...columns.map(() => "---")]),
    ...CONVERSATION_SET.map(({ ask }, position) =>
      tableRow([
        ask,
        ...columns.map(({ condition, arm }) => cell(condition, arm, position)),
      ]),
    ),
    "",
    "## Follow-ups",
    "",
    "Each `FOLLOW_UP_SET` case asked after its context turn, which is answered once",
    "with the shipped wording. A follow-up names no value to ground against, so it",
    "is scored on citing the passage it needs and on declining. One that retrieves",
    "nothing alone is rewritten from the history first, as the route does.",
    "",
    tableRow([
      "wording",
      "cites",
      "cites per run",
      "declined",
      "declined per run",
    ]),
    tableRow(Array<string>(5).fill("---")),
    ...ARMS.map((arm) =>
      tableRow([
        ARM_LABELS[arm],
        followMajority(arm, (one) => one.cites),
        followPerRun(arm, (one) => one.cites),
        followMajority(arm, (one) => one.declined),
        followPerRun(arm, (one) => one.declined),
      ]),
    ),
    "",
    tableRow(["follow-up", ...ARMS]),
    tableRow(["---", ...ARMS.map(() => "---")]),
    ...result.followUps.map(({ ask, runs }) =>
      tableRow([
        ask,
        ...ARMS.map((arm) => {
          const most = (test: (one: FollowReply) => boolean) =>
            majority(runs.map((run) => test(run.replies[arm]!)));
          if (most((one) => one.declined)) return "**declined**";
          return most((one) => one.cites) ? "yes" : "uncited";
        }),
      ]),
    ),
    "",
    "## Sequences",
    "",
    "Asked in order in one conversation. The first turn is answered once with the",
    "shipped wording, and each wording goes on from it with its own replies. The",
    "exit check's is the 1.11.0 sequence on the fixtures; the demo's starters are",
    "asked of the handbook alone, where nothing says what the right answer is, so",
    "they show only whether the page unlinked a reply.",
    "",
    ...result.sequences.flatMap(({ name, runs }) => [
      `### ${name}`,
      "",
      tableRow([
        "turn",
        "wording",
        ...runs.map((_, run) => `run ${String(run + 1)}`),
      ]),
      tableRow(["---", "---", ...runs.map(() => "---")]),
      ...runs[0]!.turns.flatMap(({ question }, turn) =>
        ARMS.map((arm) =>
          tableRow([
            question,
            arm,
            ...runs.map(({ turns }) => {
              const one = turns[turn]!.replies[arm]!;
              if (one.readAsRefusal) return "**read as a refusal**";
              return one.unlinked ? "**unlinked**" : "answered";
            }),
          ]),
        ),
      ),
      "",
    ]),
    ...Array.from({ length: RUNS }).flatMap((_, run) =>
      CONVERSATION_SET.flatMap(({ ask }, position) =>
        CONDITIONS.flatMap((condition) => {
          const asked = result[condition][position]!.runs[run]!;
          return [
            `## Run ${String(run + 1)} — ${condition} — ${ask}`,
            "",
            ...(asked.first ? quoted(asked.first) : []),
            ...ARMS.flatMap((arm) => {
              const one = asked.replies[arm]!;
              return [
                `**${ARM_LABELS[arm]}** · grounded: ${String(one.grounded)} · cites: ${String(one.cites)} · declined: ${String(one.declined)} · read as a refusal: ${String(one.readAsRefusal)}`,
                "",
                one.text,
                "",
              ];
            }),
          ];
        }),
      ),
    ),
    ...Array.from({ length: RUNS }).flatMap((_, run) =>
      result.followUps.flatMap(({ ask, runs }) => {
        const asked = runs[run]!;
        return [
          `## Run ${String(run + 1)} — follow-up — ${ask}`,
          "",
          ...asked.earlier.flatMap(quoted),
          ...(asked.searchedFor
            ? [`Searched for: ${asked.searchedFor}`, ""]
            : []),
          ...ARMS.flatMap((arm) => {
            const one = asked.replies[arm]!;
            return [
              `**${ARM_LABELS[arm]}** · cites: ${String(one.cites)} · declined: ${String(one.declined)}`,
              "",
              one.text,
              "",
            ];
          }),
        ];
      }),
    ),
    ...Array.from({ length: RUNS }).flatMap((_, run) =>
      result.sequences.flatMap(({ name, runs }) => {
        const asked = runs[run]!;
        return [
          `## Run ${String(run + 1)} — sequence — ${name}`,
          "",
          ...quoted(asked.first),
          ...asked.turns.flatMap(({ question, replies }) => [
            `### ${question}`,
            "",
            ...ARMS.flatMap((arm) => {
              const one = replies[arm]!;
              return [
                `**${ARM_LABELS[arm]}** · unlinked: ${String(one.unlinked)} · read as a refusal: ${String(one.readAsRefusal ?? "n/a")}`,
                "",
                one.text,
                "",
              ];
            }),
          ]),
        ];
      }),
    ),
  ].join("\n");
}
