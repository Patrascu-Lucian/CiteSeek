import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Not a Vitest test: counting the suite from inside it changes the count.

const README = join(import.meta.dirname, "..", "README.md");

const [layer, report] = process.argv.slice(2);

if (!layer || !report) {
  throw new Error(
    "Usage: check-test-counts <layer> <junit.xml>, e.g. Unit test-results/unit.junit.xml",
  );
}

const ran = /<testsuites[^>]*\btests="(\d+)"/.exec(
  await readFile(report, "utf8"),
)?.[1];

if (ran === undefined) {
  throw new Error(`No <testsuites tests="..."> in ${report}.`);
}

const row = (await readFile(README, "utf8"))
  .split("\n")
  .map((line) => line.split("|").map((cell) => cell.trim()))
  .find((cells) => cells[1] === layer);

if (row === undefined) {
  throw new Error(`No "${layer}" row in the README's test table.`);
}

if (row[2] !== ran) {
  throw new Error(
    `README says ${layer} is ${row[2]}; ${report} recorded ${ran}. ` +
      "Update the table in README.md.",
  );
}

console.log(`${layer}: ${ran}, and the README agrees.`);
