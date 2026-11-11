import { describe, expect, it } from "vitest";

import {
  assertEmbedderWasChosen,
  assertHostWasChosen,
  hostOf,
} from "./script-target";

const NEON = "ep-example-123456.eu-central-1.aws.neon.tech";

describe("hostOf", () => {
  it("reads the host and never the credentials", () => {
    expect(hostOf(`postgresql://user:secret@${NEON}/db`)).toBe(NEON);
  });

  it("returns null for a string that is not a URL", () => {
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("assertHostWasChosen", () => {
  const seed = { named: undefined, variable: "SEED_HOST", verb: "seed" };

  it.each(["localhost", "127.0.0.1", "host.docker.internal"])(
    "lets %s through unnamed",
    (hostname) => {
      expect(() => assertHostWasChosen({ ...seed, hostname })).not.toThrow();
    },
  );

  it("leaves an unparseable URL to the connection", () => {
    expect(() =>
      assertHostWasChosen({ ...seed, hostname: null }),
    ).not.toThrow();
  });

  it("refuses a remote host nobody named, and says how to name it", () => {
    expect(() => assertHostWasChosen({ ...seed, hostname: NEON })).toThrow(
      new RegExp(
        `Refusing to seed ${NEON} without naming it first[\\s\\S]*export SEED_HOST=ep-example-123456`,
      ),
    );
  });

  it("refuses a host other than the one named", () => {
    expect(() =>
      assertHostWasChosen({ ...seed, hostname: NEON, named: "ep-other" }),
    ).toThrow(`SEED_HOST is "ep-other" but this resolves to ${NEON}.`);
  });

  it("accepts the host it was told about", () => {
    expect(() =>
      assertHostWasChosen({
        ...seed,
        hostname: NEON,
        named: "ep-example-123456",
      }),
    ).not.toThrow();
  });

  it("speaks for the script that calls it", () => {
    expect(() =>
      assertHostWasChosen({
        hostname: NEON,
        named: undefined,
        variable: "REEMBED_HOST",
        verb: "re-embed",
      }),
    ).toThrow(/Refusing to re-embed[\s\S]*export REEMBED_HOST=/);
  });
});

describe("assertEmbedderWasChosen", () => {
  const remote = { hostname: NEON, verb: "seed" };

  it("has nothing to say about the real provider", () => {
    expect(() =>
      assertEmbedderWasChosen({
        ...remote,
        resolved: "google",
        exported: undefined,
      }),
    ).not.toThrow();
  });

  it("refuses a fake that only .env.local asked for, on a remote host", () => {
    expect(() =>
      assertEmbedderWasChosen({
        ...remote,
        resolved: "fake",
        exported: undefined,
      }),
    ).toThrow(`Refusing to seed ${NEON} with the fake embedder.`);
  });

  it("accepts a fake the shell exported, however it was cased", () => {
    expect(() =>
      assertEmbedderWasChosen({
        ...remote,
        resolved: "fake",
        exported: " FAKE ",
      }),
    ).not.toThrow();
  });

  it("lets a fake through on a local database", () => {
    expect(() =>
      assertEmbedderWasChosen({
        hostname: "localhost",
        verb: "seed",
        resolved: "fake",
        exported: undefined,
      }),
    ).not.toThrow();
  });

  it("leaves an unparseable URL to the connection", () => {
    expect(() =>
      assertEmbedderWasChosen({
        hostname: null,
        verb: "seed",
        resolved: "fake",
        exported: undefined,
      }),
    ).not.toThrow();
  });
});
