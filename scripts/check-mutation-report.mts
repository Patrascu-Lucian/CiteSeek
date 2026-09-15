/** Stryker reports a score whether or not anything ran. On Vitest 5 its per-test
 * filter matches nothing (stryker-js#6210), every covered mutant survives, and
 * the score reads as a finding. Zero killed is the instrument failing, not the
 * suite, so it fails here rather than being published. */
import { appendFile, readFile } from "node:fs/promises";

const REPORT = "reports/mutation/mutation.json";

type Report = {
  files: Record<string, { mutants: readonly { status: string }[] }>;
};

const report = JSON.parse(await readFile(REPORT, "utf8")) as Report;
const statuses = Object.values(report.files).flatMap((file) =>
  file.mutants.map((mutant) => mutant.status),
);
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

if (count("Killed") === 0) {
  throw new Error(
    `No mutant was killed in ${REPORT}. That is the runner failing to select ` +
      "tests, not a suite that detects nothing, so the score is not published.",
  );
}

// Stryker's formula, so the summary matches the HTML report.
const score = (100 * detected) / (detected + undetected);

// Set only on GitHub Actions, which renders the file on the run's page.
const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  await appendFile(
    summary,
    `## Mutation score\n\n**${score.toFixed(1)}%** of mutants detected. ${counts}\n`,
  );
}
