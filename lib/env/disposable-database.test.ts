import { describe, expect, it } from "vitest";

import {
  DISPOSABLE_OPT_IN,
  assertDisposableDatabase,
  isLoopbackDatabase,
} from "./disposable-database";

const LOCAL = "postgresql://postgres:postgres@localhost:5432/citeseek";
const NEON =
  "postgresql://owner:secret@ep-patient-river-as1rwmox-pooler.c-4.eu-central-1.aws.neon.tech/neondb";

describe("isLoopbackDatabase", () => {
  it.each([
    LOCAL,
    "postgresql://postgres@127.0.0.1:5432/citeseek",
    "postgresql://postgres@[::1]:5432/citeseek",
  ])("accepts %s", (url) => {
    expect(isLoopbackDatabase(url)).toBe(true);
  });

  it("rejects a remote host", () => {
    expect(isLoopbackDatabase(NEON)).toBe(false);
  });

  /* Not loopback, and not a crash either: the connection reports an unparseable
     URL far better than this guard could. */
  it("rejects a string that is not a URL at all", () => {
    expect(isLoopbackDatabase("not-a-url")).toBe(false);
  });
});

describe("assertDisposableDatabase", () => {
  it("admits the local database", () => {
    expect(() =>
      assertDisposableDatabase({ DATABASE_URL: LOCAL }),
    ).not.toThrow();
  });

  it("refuses a remote one, naming the host and the way out", () => {
    expect(() => assertDisposableDatabase({ DATABASE_URL: NEON })).toThrow(
      /neon\.tech/,
    );
    expect(() => assertDisposableDatabase({ DATABASE_URL: NEON })).toThrow(
      /docker compose up -d/,
    );
  });

  /*
    The failure the first version of this guard allowed. `retrieve.integration.test.ts`
    builds its forced-plan connection from `DATABASE_URL_UNPOOLED ?? DATABASE_URL`,
    so a local `DATABASE_URL` beside a remote unpooled one passed the check and then
    queried the remote database anyway — and reported an empty result rather than an
    error, which reads as a product bug.
  */
  it("refuses when only the unpooled url is remote", () => {
    expect(() =>
      assertDisposableDatabase({
        DATABASE_URL: LOCAL,
        DATABASE_URL_UNPOOLED: NEON,
      }),
    ).toThrow(/DATABASE_URL_UNPOOLED/);
  });

  it("admits when both point at the local database", () => {
    expect(() =>
      assertDisposableDatabase({
        DATABASE_URL: LOCAL,
        DATABASE_URL_UNPOOLED: LOCAL,
      }),
    ).not.toThrow();
  });

  it("names the variable at fault, not just the host", () => {
    expect(() => assertDisposableDatabase({ DATABASE_URL: NEON })).toThrow(
      /DATABASE_URL points at/,
    );
  });

  it("admits a remote one that was explicitly called disposable", () => {
    expect(() =>
      assertDisposableDatabase({
        DATABASE_URL: NEON,
        [DISPOSABLE_OPT_IN]: "yes",
      }),
    ).not.toThrow();
  });

  /* The opt-in is a claim, not a truthiness check: anything short of "yes" is
     someone who set a variable without reading what it asserts. */
  it("ignores an opt-in that does not say yes", () => {
    expect(() =>
      assertDisposableDatabase({
        DATABASE_URL: NEON,
        [DISPOSABLE_OPT_IN]: "1",
      }),
    ).toThrow();
  });

  it("says nothing when there is no target to check", () => {
    expect(() => assertDisposableDatabase({})).not.toThrow();
  });
});
