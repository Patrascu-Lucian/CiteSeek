/** Stryker reports a score whether or not anything ran. On Vitest 5 its per-test
 * filter matches nothing (stryker-js#6210), every covered mutant survives, and
 * the score reads as a finding. No covered mutant killed is the instrument
 * failing, not the suite, so it fails here rather than being published. */
import { appendFile, readFile, writeFile } from "node:fs/promises";

const REPORT = "reports/mutation/mutation.json";

/* Committed, because the landing page quotes this score and `landing.test.tsx`
   checks every figure on it against something a tool wrote. The report itself is
   gitignored, so the numbers the page uses are published here. */
const PUBLISHED = "eval/mutation.md";

type Mutant = { status: string; static?: boolean };

type Report = { files: Record<string, { mutants: readonly Mutant[] }> };

const report = JSON.parse(await readFile(REPORT, "utf8")) as Report;
const mutants = Object.values(report.files).flatMap((file) => file.mutants);
const statuses = mutants.map((mutant) => mutant.status);
const count = (status: string) =>
  statuses.filter((one) => one === status).length;

const detected = count("Killed") + count("Timeout");
const undetected = count("Survived") + count("NoCoverage");

// Ignored mutants and ones that failed to compile or run are outside the score,
// but counted, so the parts add up to the total.
const counts =
  `${String(statuses.length)} mutants: ${String(count("Killed"))} killed, ` +
  `${String(count("Survived"))} survived, ${String(count("NoCoverage"))} without coverage, ` +
  `${String(count("Timeout"))} timed out, ` +
  `${String(statuses.length - detected - undetected)} ignored or errored.`;

console.log(counts);

// Static mutants rerun every test without the filter, so a broken filter still
// kills them, and counting them would pass the run it exists to stop.
const killedThroughFilter = mutants.filter(
  (mutant) => mutant.static !== true && mutant.status === "Killed",
).length;

if (killedThroughFilter === 0) {
  throw new Error(
    `No covered mutant was killed in ${REPORT}. That is the runner failing to ` +
      "select tests, not a suite that detects nothing, so the score is not published.",
  );
}

// Stryker's formula, so the summary matches the HTML report.
const score = (100 * detected) / (detected + undetected);

const today = new Date().toISOString().slice(0, 10);

await writeFile(
  PUBLISHED,
  `# Mutation testing

Run ${today} by \`pnpm test:mutation\`, over \`lib/rag\` and \`lib/ai\`; the
exclusions are in \`stryker.config.mjs\`.

**${score.toFixed(2)}%** of **${String(statuses.length)} mutants** detected.

${counts}

A mutant is a deliberate change to the code, and a detected one is a change some
test noticed. Coverage says only that a line ran.
`,
);

// Set only on GitHub Actions, which renders the file on the run's page.
const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  await appendFile(
    summary,
    `## Mutation score\n\n**${score.toFixed(1)}%** of mutants detected. ${counts}\n`,
  );
}
