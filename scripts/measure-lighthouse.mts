/**
 * The four category scores and the metrics behind the performance one, taken the
 * way the README's table is taken — so re-measuring after a deploy is a command
 * rather than a checklist of curl, a cookie file and a Chrome path.
 *
 * Pinned to one Lighthouse version on purpose: scores move between releases, and
 * two runs of different versions are not a before and after.
 */
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { base, guestSession, median } from "./measure/session.mts";

const LIGHTHOUSE = "lighthouse@12.8.2";

// Node 24 refuses to spawn a `.cmd` without a shell (CVE-2024-27980), and `npx`
// is one on Windows. Nowhere else needs it, so nowhere else pays for `q`.
const SHELL = process.platform === "win32";
const q = (value: string) => (SHELL ? `"${value}"` : value);

if (SHELL) {
  // Answered by `q`. Printed on every run it would train the eye to skip
  // warnings from this script.
  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    if (!warning.message.includes("shell option")) console.warn(warning);
  });
}

const runs = Number(process.env.MEASURE_RUNS ?? "3");

if (!Number.isInteger(runs) || runs < 1) {
  throw new Error(
    `MEASURE_RUNS must be a positive integer, not "${String(process.env.MEASURE_RUNS)}".`,
  );
}

const TARGETS = ["workspace", "landing"] as const;
const name = process.argv[2] ?? "workspace";

if (!(TARGETS as readonly string[]).includes(name)) {
  throw new Error(
    `Unknown target "${name}". Expected ${TARGETS.join(" or ")}.`,
  );
}

/** The landing page is public, so it needs no session and `base` is the page. */
const session = name === "landing" ? null : await guestSession();
const url = session?.location ?? base;
const cookie = session?.cookie ?? "";
const scratch = mkdtempSync(join(tmpdir(), "citeseek-lh-"));

type Report = {
  categories: Record<string, { score: number }>;
  audits: Record<string, { score: number | null; displayValue?: string }>;
};

function once(index: number): Report {
  const headers = join(scratch, "headers.json");
  const output = join(scratch, `run-${String(index)}.json`);
  writeFileSync(headers, JSON.stringify(cookie ? { Cookie: cookie } : {}));

  const result = spawnSync(
    "npx",
    [
      "-y",
      LIGHTHOUSE,
      // `tmpdir()` sits under the Windows user profile, which routinely holds a
      // space, and `url` is `/demo`'s redirect rather than a value chosen here.
      q(url),
      "--quiet",
      q("--chrome-flags=--headless=new --no-sandbox"),
      `--extra-headers=${q(headers)}`,
      "--output=json",
      `--output-path=${q(output)}`,
    ],
    {
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
      shell: SHELL,
    },
  );

  // Lighthouse exits non-zero on a failed audit run, and also on a Windows
  // temp-directory cleanup error that leaves a perfectly good report behind.
  try {
    return JSON.parse(readFileSync(output, "utf8")) as Report;
  } catch {
    // `status` is null when the spawn itself failed, which an exit code alone
    // says nothing about.
    const why =
      result.error?.message ??
      String(result.stderr ?? "")
        .trim()
        .split("\n")
        .slice(-3)
        .join("\n");

    throw new Error(
      `Lighthouse produced no report (exit ${String(result.status)}).${why ? `\n${why}` : ""}`,
    );
  }
}

const CATEGORIES = [
  ["performance", "Performance"],
  ["accessibility", "Accessibility"],
  ["best-practices", "Best practices"],
  ["seo", "SEO"],
] as const;

const score = (report: Report, key: string) =>
  Math.round((report.categories[key]?.score ?? 0) * 100);

const reports: Report[] = [];

try {
  for (let i = 1; i <= runs; i += 1) {
    const report = once(i);
    reports.push(report);
    console.log(
      `  ${String(i)}: ${CATEGORIES.map(([key]) => `${key} ${String(score(report, key))}`).join("  ")}`,
    );
  }

  console.log(`\n${url}`);
  for (const [key, label] of CATEGORIES) {
    console.log(
      `  ${label.padEnd(15)} ${String(median(reports.map((r) => score(r, key))))}`,
    );
  }

  // The category score is a weighted sum; without the parts, a drop names no
  // cause and the next reader re-derives it.
  console.log("\n  Performance metrics, last run:");
  for (const id of [
    "first-contentful-paint",
    "largest-contentful-paint",
    "total-blocking-time",
    "cumulative-layout-shift",
    "speed-index",
  ]) {
    const audit = reports.at(-1)!.audits[id];
    console.log(
      `    ${String(Math.round((audit?.score ?? 0) * 100)).padStart(4)}  ${(audit?.displayValue ?? "").padEnd(8)} ${id}`,
    );
  }

  // The element, when there is one. Finding it by hand is a Lighthouse trace and
  // twenty minutes; the audit is only emitted when something actually shifted.
  const shifted = (
    reports.at(-1)!.audits["layout-shift-elements"] as
      | {
          details?: {
            items?: { node?: { snippet?: string }; score?: number }[];
          };
        }
      | undefined
  )?.details?.items;

  if (shifted?.length) {
    console.log("\n  Shifting elements, last run:");
    for (const item of shifted.slice(0, 3)) {
      console.log(
        `    ${String(item.score ?? "")
          .slice(0, 6)
          .padStart(6)}  ${String(item.node?.snippet ?? "?").slice(0, 80)}`,
      );
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
