import { describe, expect, it } from "vitest";

import {
  type EmbeddedRow,
  outcomeLine,
  parseReembedArgs,
  planReembed,
  readingLine,
  summarizeReembed,
} from "./reembed-plan";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";

function row(overrides: Partial<EmbeddedRow>): EmbeddedRow {
  return {
    workspaceId: WORKSPACE,
    isDemo: false,
    documentId: "d1",
    filename: "handbook.pdf",
    status: "ready",
    model: "fake",
    chunks: 3,
    ...overrides,
  };
}

describe("parseReembedArgs", () => {
  it("reports when given nothing", () => {
    expect(parseReembedArgs([])).toEqual({ apply: false });
  });

  it("applies to the demo, or to one workspace", () => {
    expect(parseReembedArgs(["--apply", "--demo"])).toEqual({
      apply: true,
      scope: { demo: true },
    });
    expect(parseReembedArgs(["--apply", `--workspace=${WORKSPACE}`])).toEqual({
      apply: true,
      scope: { workspaceId: WORKSPACE },
    });
  });

  it("refuses to apply without a scope", () => {
    expect(() => parseReembedArgs(["--apply"])).toThrow(/needs a scope/);
  });

  it("refuses two scopes at once", () => {
    expect(() =>
      parseReembedArgs(["--apply", "--demo", `--workspace=${WORKSPACE}`]),
    ).toThrow(/not both/);
  });

  it("refuses a workspace that is not an id", () => {
    expect(() =>
      parseReembedArgs(["--apply", "--workspace=demo-workspace"]),
    ).toThrow(/expects a workspace id/);
  });

  it("refuses a scope that would do nothing without --apply", () => {
    expect(() => parseReembedArgs(["--demo"])).toThrow(/only applies with/);
  });

  it("refuses an argument it does not know", () => {
    expect(() => parseReembedArgs(["--force"])).toThrow(/Unknown argument/);
  });
});

describe("planReembed", () => {
  it("says so when nothing is embedded at all", () => {
    const plan = planReembed([], "fake");

    expect(plan.affected).toEqual([]);
    expect(plan.lines).toContain("No embedded vectors at all.");
  });

  it("finds nothing to do when every vector is the configured model's", () => {
    const plan = planReembed([row({})], "fake");

    expect(plan.affected).toEqual([]);
    expect(plan.lines.join("\n")).toMatch(/Nothing to re-embed/);
  });

  it("counts another model's and unlabeled vectors as the ones to redo", () => {
    const plan = planReembed(
      [
        row({ model: "fake", chunks: 3 }),
        row({ model: "gemini-embedding-001", chunks: 2 }),
        row({ model: null, chunks: 1 }),
      ],
      "fake",
    );

    expect(plan.affected).toEqual([
      {
        workspaceId: WORKSPACE,
        documentId: "d1",
        filename: "handbook.pdf",
        foreign: 3,
      },
    ]);
    expect(plan.lines.join("\n")).toContain(
      "fake 3, gemini-embedding-001 2, unlabeled 1",
    );
  });

  it("names each affected document's workspace, and marks the demo", () => {
    const plan = planReembed(
      [
        row({ documentId: "d1", model: "gemini-embedding-001", isDemo: true }),
        row({ documentId: "d2", model: "fake" }),
      ],
      "fake",
    );

    expect(plan.affected.map((document) => document.documentId)).toEqual([
      "d1",
    ]);
    expect(plan.lines.join("\n")).toMatch(
      new RegExp(
        `in 1 of 2 document[\\s\\S]*workspace ${WORKSPACE} \\(demo\\)`,
      ),
    );
  });
});

describe("readingLine", () => {
  it("names the host and the model the shell chose", () => {
    expect(readingLine("ep-a", "gemini-embedding-001", "google")).toBe(
      "Reading ep-a, configured for gemini-embedding-001.",
    );
  });

  it("says when the model came from .env.local or the default, not the shell", () => {
    expect(readingLine("ep-a", "fake", undefined)).toMatch(
      /^Reading ep-a, configured for fake by \.env\.local or the default\. .*export EMBEDDINGS_PROVIDER/,
    );
    expect(readingLine("ep-a", "fake", " ")).toMatch(/by \.env\.local/);
  });

  it("still prints when the URL does not parse", () => {
    expect(readingLine(null, "fake", "fake")).toBe(
      "Reading an unparseable DATABASE_URL, configured for fake.",
    );
  });
});

describe("outcomeLine", () => {
  const document = { filename: "handbook.pdf", foreign: 40 };

  it("counts what was re-embedded", () => {
    expect(outcomeLine(document, { reembedded: 40, error: null })).toBe(
      "  handbook.pdf: 40 of 40 re-embedded.",
    );
  });

  it("says how far a failed run got, and why it stopped", () => {
    expect(
      outcomeLine(document, { reembedded: 32, error: "429 rate limit" }),
    ).toBe("  handbook.pdf: 32 of 40 re-embedded, then: 429 rate limit");
  });
});

describe("summarizeReembed", () => {
  it("succeeds when every vector in scope is the configured model's", () => {
    expect(summarizeReembed([row({})], ["d1"], "fake")).toEqual({
      exitCode: 0,
      line: "Every vector in 1 document(s) is now fake's.",
    });
  });

  it("fails, and says how many are left, when another model's vectors remain", () => {
    expect(
      summarizeReembed(
        [
          row({}),
          row({ model: "gemini-embedding-001", chunks: 5 }),
          row({ model: null, chunks: 2 }),
        ],
        ["d1"],
        "fake",
      ),
    ).toEqual({
      exitCode: 1,
      line: "7 vector(s) in 1 document(s) are still not fake's. Run the same command again to continue.",
    });
  });

  it("does not judge status, which re-embedding in place never changes", () => {
    expect(
      summarizeReembed([row({ status: "failed" })], ["d1"], "fake").exitCode,
    ).toBe(0);
  });

  it("counts only the documents in scope", () => {
    expect(
      summarizeReembed(
        [row({}), row({ documentId: "d2", model: "gemini-embedding-001" })],
        ["d1"],
        "fake",
      ).exitCode,
    ).toBe(0);
  });

  it("says so when there was nothing in scope", () => {
    expect(summarizeReembed([], [], "fake")).toEqual({
      exitCode: 0,
      line: "Nothing in this scope to re-embed.",
    });
  });
});
