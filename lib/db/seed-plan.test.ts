import { describe, expect, it } from "vitest";

import { planFixtureSeed, seedExitCode } from "./seed-plan";

const FILENAME = "northwind-remote-work-handbook.pdf";
const SUPERSEDED = ["northwind-remote-work-handbook.md"];

/** `ready` unless a test says otherwise: the earlier cases are about filenames. */
function plan(existing: { id: string; filename: string; status?: string }[]) {
  return planFixtureSeed({
    existing: existing.map((one) => ({ status: "ready", ...one })),
    filename: FILENAME,
    supersededFilenames: SUPERSEDED,
  });
}

describe("planFixtureSeed", () => {
  it("seeds into an empty workspace", () => {
    expect(plan([])).toMatchObject({ create: true, remove: [] });
  });

  it("does nothing when the fixture is already there", () => {
    // Idempotence, which CI asserts by running the seed twice.
    expect(plan([{ id: "d1", filename: FILENAME }])).toMatchObject({
      create: false,
      remove: [],
    });
  });

  it("replaces a superseded version of the fixture", () => {
    /*
      The trap this rule exists for. The old check was "does the workspace hold
      any document at all", which is idempotent toward *whatever landed first*:
      every already-seeded database — production included — would have kept the
      Markdown handbook forever while the seed reported success.
    */
    expect(
      plan([{ id: "d1", filename: "northwind-remote-work-handbook.md" }]),
    ).toMatchObject({ create: true, remove: ["d1"] });
  });

  it("leaves documents it does not own alone", () => {
    // A demo someone added a second file to should keep it. This owns one
    // document, not the workspace.
    expect(
      plan([{ id: "d1", filename: "someone-elses-upload.pdf" }]),
    ).toMatchObject({
      create: true,
      remove: [],
    });
  });

  it("keeps the fixture even when something superseded is also present", () => {
    // Both filenames in one workspace is the state a half-finished run leaves.
    // The fixture is already correct, so the run is still a no-op — cleaning up
    // the stale one is a separate concern from seeding.
    expect(
      plan([
        { id: "d1", filename: FILENAME },
        { id: "d2", filename: "northwind-remote-work-handbook.md" },
      ]),
    ).toMatchObject({ create: false });
  });

  it("says what it decided, for the log", () => {
    // A seed that only reports that it ran is how the two-database bug stayed
    // invisible: every line was true and said nothing about what changed.
    expect(plan([]).reason).toMatch(/seeding/i);
    expect(plan([{ id: "d1", filename: FILENAME }]).reason).toMatch(/already/i);
    expect(
      plan([{ id: "d1", filename: "northwind-remote-work-handbook.md" }])
        .reason,
    ).toMatch(/replacing/i);
  });

  it("replaces a fixture an earlier run left failed", () => {
    // Kept, it would read as present to every later run, and a re-run with the
    // provider fixed could never repair the demo.
    expect(plan([{ id: "d1", filename: FILENAME, status: "failed" }])).toEqual({
      create: true,
      remove: ["d1"],
      reason: `replacing ${FILENAME}, which was failed`,
    });
  });

  it("replaces a fixture an interrupted run left unfinished", () => {
    for (const status of ["queued", "processing"]) {
      expect(plan([{ id: "d1", filename: FILENAME, status }])).toMatchObject({
        create: true,
        remove: ["d1"],
      });
    }
  });
});

describe("seedExitCode", () => {
  it("passes only a ready fixture", () => {
    expect(seedExitCode("ready")).toBe(0);
  });

  it("fails every other status, and a fixture that is not there", () => {
    for (const status of ["failed", "queued", "processing", undefined]) {
      expect(seedExitCode(status)).toBe(1);
    }
  });
});
