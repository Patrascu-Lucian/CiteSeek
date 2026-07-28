import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Guards against a failure that is invisible locally and only surfaces in CI.
 *
 * A NUL byte anywhere in a file trips git's binary heuristic. Binary files are
 * exempt from `.gitattributes` line-ending normalization, so a file written on
 * Windows keeps its CRLF endings through commit — and Prettier, which expects
 * LF, then rejects it on a Linux runner while passing on the machine that wrote
 * it. The symptom (a formatting error) is several steps removed from the cause
 * (a control character in a string literal), which is what makes it expensive to
 * diagnose the second time.
 *
 * Control characters in source should be written as escape sequences anyway:
 * a literal NUL or non-breaking space is invisible in a diff and unreviewable.
 */

const BINARY_EXTENSIONS =
  /\.(pdf|docx|ico|png|jpe?g|gif|webp|woff2?|ttf|eot|zip|gz)$/i;

function trackedTextFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    cwd: process.cwd(),
  });

  return output
    .split("\0")
    .filter((path) => path.length > 0 && !BINARY_EXTENSIONS.test(path))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        // Staged-but-deleted files still appear in `git ls-files`.
        return false;
      }
    });
}

describe("tracked source files", () => {
  it("contain no NUL bytes", () => {
    const offenders = trackedTextFiles().filter((path) =>
      readFileSync(path).includes(0),
    );

    expect(
      offenders,
      "These files contain a literal NUL byte, so git treats them as binary and " +
        "skips line-ending normalization. Write control characters as escape " +
        "sequences instead — for example \\0 rather than a raw NUL.",
    ).toEqual([]);
  });

  it("contain no carriage returns", () => {
    // `.gitattributes` sets `eol=lf`, so CRLF in a tracked file means the file
    // escaped normalization — almost always because of the NUL problem above.
    const offenders = trackedTextFiles().filter((path) =>
      readFileSync(path).includes(0x0d),
    );

    expect(
      offenders,
      "These files contain CRLF line endings, which Prettier rejects on CI.",
    ).toEqual([]);
  });
});
