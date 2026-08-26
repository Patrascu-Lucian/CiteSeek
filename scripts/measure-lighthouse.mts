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

const LIGHTHOUSE = "lighthouse@12.8.2";

const base = process.env.MEASURE_BASE_URL ?? "http://localhost:3000";
const runs = Number(process.env.MEASURE_RUNS ?? "3");

// Catches a typo before three Lighthouse runs discover it.
new URL(base);

// Node warns that `shell: true` concatenates arguments unescaped. It is right in
// general and answered below; printed on every run it would train the eye to
// skip warnings from this script.
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (!warning.message.includes("shell option")) console.warn(warning);
});

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

/** `/w/*` without a session redirects to sign-in, so an anonymous run would
 * score a different page entirely. */
async function guest(): Promise<{ url: string; cookie: string }> {
  if (name === "landing") return { url: base, cookie: "" };

  const response = await fetch(`${base}/demo`, { redirect: "manual" }).catch(
    (cause: unknown) => {
      throw new Error(`Cannot reach ${base}.`, { cause });
    },
  );

  const cookie = response.headers
    .getSetCookie()
    .map((one) => one.split(";")[0])
    .join("; ");
  const location = response.headers.get("location");

  if (!cookie || !location) throw new Error("/demo gave no guest session.");

  return { url: new URL(location, base).href, cookie };
}

const { url, cookie } = await guest();
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
      url,
      "--quiet",
      // Quoted: the value contains a space, and `shell` below would otherwise
      // hand Lighthouse two arguments and Chrome only the first.
      '--chrome-flags="--headless=new --no-sandbox"',
      `--extra-headers=${headers}`,
      "--output=json",
      `--output-path=${output}`,
    ],
    // `shell` because `npx` is a `.cmd` on Windows and will not spawn without
    // one. Not a hole worth closing: `MEASURE_BASE_URL` is the only value from
    // outside, and whoever sets it already has this shell. `new URL` above
    // catches a typo, not an injection — a valid URL can hold `$(…)`.
    {
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
      shell: true,
    },
  );

  // Lighthouse exits non-zero on a failed audit run, and also on a Windows
  // temp-directory cleanup error that leaves a perfectly good report behind.
  try {
    return JSON.parse(readFileSync(output, "utf8")) as Report;
  } catch {
    throw new Error(
      `Lighthouse produced no report (exit ${String(result.status)}).`,
    );
  }
}

const CATEGORIES = [
  ["performance", "Performance"],
  ["accessibility", "Accessibility"],
  ["best-practices", "Best practices"],
  ["seo", "SEO"],
] as const;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
};

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
