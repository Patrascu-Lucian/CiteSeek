import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/* An ignored advisory stops reminding anyone, so the two facts that make
   ignoring it safe are checked here instead. Read as text, like
   `README.test.ts` reads the README: no YAML parser is a dependency. */
const read = (file: string) =>
  readFileSync(join(import.meta.dirname, file), "utf8");

const ADVISORY = "GHSA-vwc7-r8mq-g2x9";

const workspace = read("pnpm-workspace.yaml");
const lockfile = read("pnpm-lock.yaml");

const ignored = /^audit:\n {2}ignore:\n((?: {4}- .+\n?)+)/m
  .exec(workspace)?.[1]
  ?.includes(ADVISORY);

const postinstall =
  /^allowBuilds:\n(?: {2}.+\n)*? {2}onnxruntime-node: (true|false)$/m.exec(
    workspace,
  )?.[1];

const admZipVersions = [
  ...lockfile.matchAll(/^ {2}adm-zip@(\d+\.\d+\.\d+):/gm),
].map((match) => match[1]!);

/** Affected >=0.5.9 <=0.6.0; nothing patched. */
const affected = (version: string) => {
  const [major, minor, patch] = version.split(".").map(Number) as [
    number,
    number,
    number,
  ];
  const n = major * 1_000_000 + minor * 1_000 + patch;
  return n >= 5_009 && n <= 6_000;
};

describe("the ignored adm-zip advisory", () => {
  it("finds what it checks, rather than passing on a pattern that no longer matches", () => {
    expect(ignored, "no audit.ignore list naming the advisory").toBe(true);
    expect(
      postinstall,
      "no onnxruntime-node line under allowBuilds",
    ).toBeDefined();
  });

  it("keeps denied the only postinstall that calls adm-zip", () => {
    // That script extracts into a temp directory, which is the advisory's
    // precondition. Allowing it makes the ignored advisory reachable.
    expect(postinstall).toBe("false");
  });

  it("is retired once adm-zip leaves the affected range", () => {
    // A patched release or onnxruntime-node dropping the dependency both make
    // the ignore dead weight that would hide a real advisory later.
    expect(admZipVersions.length).toBeGreaterThan(0);
    expect(admZipVersions.every(affected)).toBe(true);
  });
});
