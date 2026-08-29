/**
 * `eval:local-answers`' questions on WebGPU, against a server you started
 * (`pnpm build && pnpm start`). That harness runs on the CPU; same weights, so a
 * difference between them is the device.
 *
 * By hand, never in CI: 884 MB and a GPU. `--limit=N` to smoke-test, `--fresh`
 * to discard a half-finished run instead of resuming it.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium, type Page } from "@playwright/test";

import { LOCAL_ANSWER_SET } from "../eval/golden-set.ts";
import { grounds } from "../eval/scoring.ts";

const BASE_URL = process.env.LOCAL_MARKERS_BASE_URL ?? "http://localhost:3000";

const EVAL = join(import.meta.dirname, "..", "eval");

// Persistent: the weights live in the Cache API, so an ephemeral context
// re-downloads 884 MB every run.
const PROFILE = join(import.meta.dirname, "..", ".local-model-profile");

// Written after every answer: this run takes an hour and has been killed twice.
const PROGRESS = join(EVAL, ".local-markers-progress.json");

const FIXTURES = [
  "meridian-support-policy.md",
  "harbourline-equipment-manual.md",
  "larkfield-tenancy-agreement.md",
];

const limit = Number(
  process.argv.find((one) => one.startsWith("--limit="))?.slice(8) ??
    LOCAL_ANSWER_SET.length,
);

// `slice(0, NaN)` is empty: a typo would index everything, ask nothing, and
// report 0/0 minutes later.
if (!Number.isInteger(limit) || limit < 1) {
  throw new Error(`--limit must be a positive integer, got: ${String(limit)}`);
}

const cases = LOCAL_ANSWER_SET.slice(0, limit);

type Row = {
  question: string;
  answer: string;
  grounded: boolean;
  chips: number;
};

// Only a full run resumes or records: a `--limit` smoke test's rows were once
// adopted by the next real run and published.
const full = limit === LOCAL_ANSWER_SET.length;

type Progress = { baseUrl: string; rows: Row[] };

const done: Row[] =
  !full || process.argv.includes("--fresh")
    ? []
    : await readFile(PROGRESS, "utf8")
        .then((text) => JSON.parse(text) as Progress)
        // A different server is a different corpus: IndexedDB is per origin.
        .then((saved) => (saved.baseUrl === BASE_URL ? saved.rows : []))
        .catch(() => []);

await mkdir(PROFILE, { recursive: true });

// A context per question, not a reload: reloading leaked GPU sessions until the
// machine died, twice.
async function openPage() {
  const context = await chromium.launchPersistentContext(PROFILE, {
    // Not the default: that is `chromium-headless-shell`, which has no GPU stack
    // and no flag that gives it one.
    channel: "chromium",
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${BASE_URL}/local`);

  return { context, page };
}

const composerIn = (page: Page) =>
  page.getByRole("textbox", { name: /ask a question/i });

/* The gate is per page load, not per profile: consent is remembered, the loaded
   weights are not. Polled, because for a moment after a load neither the gate
   nor the composer exists, and asking once there skips the click forever. */
async function waitUntilAnswerable(page: Page) {
  const composer = composerIn(page);
  const consent = page.getByRole("button", { name: /download the model/i });
  const deadline = Date.now() + 20 * 60_000;

  while (Date.now() < deadline) {
    if (await composer.isVisible().catch(() => false)) return;
    if (await consent.isVisible().catch(() => false)) await consent.click();

    await page.waitForTimeout(500);
  }

  throw new Error(
    "The composer never appeared; the model did not finish loading.",
  );
}

async function setUp() {
  const { context, page } = await openPage();

  // WebGPU is `[SecureContext]`: on a non-secure origin this reads as "no GPU"
  // rather than "wrong URL", so the message reports both.
  const adapter = await page.evaluate(async () => {
    // Not `lib/local/webgpu.ts`: the body is shipped to the browser, so an
    // import would not resolve.
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter: () => Promise<unknown> };
      }
    ).gpu;

    if (!gpu) return { secure: isSecureContext, ok: false };

    return { secure: isSecureContext, ok: Boolean(await gpu.requestAdapter()) };
  });

  if (!adapter.ok) {
    throw new Error(
      `No WebGPU adapter at ${BASE_URL} (secure context: ${String(adapter.secure)}).`,
    );
  }

  // The profile persists, so a second run would index the fixtures on top of
  // the first run's copies and quietly double the corpus.
  const clear = page.getByRole("button", { name: /^delete everything$/i });

  if (await clear.isEnabled().catch(() => false)) {
    await clear.click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^delete everything$/i })
      .click();

    // Deleting is async and `click()` returns on dispatch, so uploading now can
    // race the clear and lose the first fixture to it.
    await clear.and(page.locator(":disabled")).waitFor({ timeout: 60_000 });
  }

  console.log(
    `WebGPU adapter present. Indexing ${String(FIXTURES.length)} documents…`,
  );

  for (const file of FIXTURES) {
    await page
      .locator('input[type="file"]')
      .setInputFiles(join(EVAL, "fixtures", file));

    const status = page
      .getByRole("region", { name: /add a document/i })
      .getByRole("status");

    // Two waits: only the in-progress messages name the file, and "Indexed…"
    // alone matches the previous file's — which lost the third fixture.
    await status.filter({ hasText: file }).waitFor({ timeout: 60_000 });
    await status
      .filter({ hasText: /^Indexed \d+ passages? on this machine/i })
      .waitFor({ timeout: 10 * 60_000 });

    console.log(`  ${file}`);
  }

  await context.close();
}

async function ask(question: string): Promise<Row> {
  const { context, page } = await openPage();

  try {
    await waitUntilAnswerable(page);

    const composer = composerIn(page);
    const send = page.getByRole("button", { name: /send the question/i });
    const answered = page.locator(
      '[data-message-bubble="assistant"]:not([data-pending])',
    );

    await composer.fill(question);
    await send.click();

    // Start, then stop. One button is Send or Stop, so waiting for Send straight
    // after the click matches the one that has not flipped yet.
    await answered.first().waitFor({ timeout: 10 * 60_000 });
    await send.waitFor({ timeout: 10 * 60_000 });

    const bubble = answered.first();

    /* A failed stream leaves a settled bubble holding a fragment, and its error
       renders outside the bubble — so the waits above pass. The retry button,
       not `role="alert"`: an empty alert node is always on the page. */
    const failed = await page
      .getByRole("button", { name: /try again/i })
      .isVisible()
      .catch(() => false);

    if (failed)
      throw new Error(`The answer to "${question}" failed to stream.`);

    return {
      question,
      // `[data-answer-prose]`, not the bubble: the "nothing here is cited"
      // notice sits inside the bubble and is not the model's output.
      answer: (await bubble.locator("[data-answer-prose]").innerText()).trim(),
      // Chips, not `[n]`: markers become links before rendering, so a bracket
      // never reaches the DOM.
      chips: await bubble.getByRole("button", { name: /citation \d/i }).count(),
      grounded: false,
    };
  } finally {
    await context.close();
  }
}

/* A partial corpus answers anyway and scores whatever it can — a crashed run
   left two of three fixtures indexed and said nothing. On resume too: the
   profile is 884 MB someone reclaims, and an empty store renders no composer,
   which times out twenty minutes later blaming the model. */
async function assertCorpus() {
  const { context, page } = await openPage();

  try {
    const summary = await page
      .getByText(/\d+ documents? and \d+ passages?/)
      .innerText()
      .catch(() => "nothing");

    if (!summary.startsWith(`${String(FIXTURES.length)} documents`)) {
      throw new Error(
        `Expected ${String(FIXTURES.length)} documents, found: ${summary}`,
      );
    }
  } finally {
    await context.close();
  }
}

if (done.length > 0) {
  console.log(`Resuming: ${String(done.length)} answers already recorded.`);
} else {
  await setUp();
}

await assertCorpus();

const rows: Row[] = [...done];

for (const [index, one] of cases.entries()) {
  if (rows.some((row) => row.question === one.question)) continue;

  const row = await ask(one.question);
  rows.push({ ...row, grounded: grounds(row.answer, one.answerContains) });

  if (full) {
    await writeFile(
      PROGRESS,
      JSON.stringify({ baseUrl: BASE_URL, rows } satisfies Progress, null, 2),
    );
  }

  console.log(
    `  ${String(index + 1)}/${String(cases.length)} ${row.chips > 0 ? `cited x${String(row.chips)}` : "uncited"} ${rows.at(-1)!.grounded ? "grounded" : ""}`,
  );
}

const share = (of: (row: Row) => boolean) =>
  `${String(rows.filter(of).length)}/${String(rows.length)}`;

const report = [
  "# Local answers, in a browser",
  "",
  `Run ${new Date().toISOString().slice(0, 10)} against \`${BASE_URL}\`, on WebGPU.`,
  "",
  "The questions and the scorer come from `eval:local-answers`, and retrieval is",
  "the page's own — so this is that harness's eight-passage row, measured where",
  "the product runs. The oracle column has no equivalent: the UI has no way to",
  "hand a passage over.",
  "",
  "Each question is asked in its own browser, because `useChat` sends the whole",
  "history and the CPU harness asks every question cold.",
  "",
  "`cited` counts **citation chips in the answer**, not `[n]` in the text. Markers",
  "are rewritten into links before rendering, so a bracket never reaches the DOM;",
  "a chip is also the stricter claim, since it resolved to a passage.",
  "",
  `**Grounded ${share((row) => row.grounded)}, cited ${share((row) => row.chips > 0)}.**`,
  "Compare against the eight-passage row of `eval/local-answers.md`, which is the",
  "same questions on the CPU. The comparison is written up in `docs/backlog.md`",
  "rather than here, because a number copied into two generated files goes stale",
  "in one of them.",
  "",
  "## Per question",
  "",
  "| question | grounded | chips |",
  "| -------- | -------- | ----- |",
  ...rows.map(
    (row) =>
      `| ${row.question} | ${row.grounded ? "yes" : "**no**"} | ${String(row.chips)} |`,
  ),
  "",
  "## Answers",
  "",
  'Verbatim, including the model\'s own spelling — "regground", "every 1 years".',
  "Correcting those edits the evidence.",
  "",
  ...rows.flatMap((row) => [
    `**${row.question}**`,
    "",
    `> ${row.answer.replace(/\n+/g, "\n> ")}`,
    "",
  ]),
].join("\n");

const partial = rows.length < LOCAL_ANSWER_SET.length;

// A partial run's report is indistinguishable from a full one at a glance.
if (!partial) {
  await writeFile(join(EVAL, "local-markers.md"), `${report}\n`);
  await rm(PROGRESS, { force: true });
}

console.log(
  `\ngrounded:${share((row) => row.grounded)}  cited:${share((row) => row.chips > 0)}  ` +
    (partial
      ? `${String(rows.length)} of ${String(LOCAL_ANSWER_SET.length)} questions, so nothing written`
      : "Written to eval/local-markers.md"),
);
