/** Stryker reports a score whether or not anything ran. On Vitest 5 its per-test
 * filter matches nothing (stryker-js#6210), every covered mutant survives, and
 * the score reads as a finding. Zero killed is the instrument failing, not the
 * suite, so it fails here rather than being published. */
import { readFile } from "node:fs/promises";

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

console.log(
  `${String(statuses.length)} mutants: ${String(count("Killed"))} killed, ` +
    `${String(count("Survived"))} survived, ${String(count("NoCoverage"))} without coverage, ` +
    `${String(count("Timeout"))} timed out.`,
);

if (count("Killed") === 0) {
  throw new Error(
    `No mutant was killed in ${REPORT}. That is the runner failing to select ` +
      "tests, not a suite that detects nothing, so the score is not published.",
  );
}
