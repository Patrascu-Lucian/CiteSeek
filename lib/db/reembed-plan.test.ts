import { describe, expect, it } from "vitest";

import {
  type EmbeddedRow,
  parseReembedArgs,
  planReembed,
  reembedExitCode,
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

describe("reembedExitCode", () => {
  it("succeeds when every document in scope ends ready on the configured model", () => {
    expect(reembedExitCode([row({})], ["d1"], "fake")).toBe(0);
  });

  it("fails when a document is left with another model's vectors", () => {
    expect(
      reembedExitCode(
        [row({}), row({ model: "gemini-embedding-001" })],
        ["d1"],
        "fake",
      ),
    ).toBe(1);
  });

  it("fails when a document did not end ready", () => {
    expect(reembedExitCode([row({ status: "failed" })], ["d1"], "fake")).toBe(
      1,
    );
  });

  it("fails when a document ended with nothing embedded at all", () => {
    expect(reembedExitCode([], ["d1"], "fake")).toBe(1);
  });

  it("succeeds when there was nothing in scope to repair", () => {
    expect(reembedExitCode([], [], "fake")).toBe(0);
  });
});
