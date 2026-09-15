import { describe, expect, it } from "vitest";

import { namesHost } from "./named-host";

const host = "ep-quiet-river-a1b2c3.eu-central-1.aws.neon.tech";

describe("namesHost", () => {
  it("accepts any fragment that picks out the host", () => {
    expect(namesHost("ep-quiet-river", host)).toBe(true);
  });

  it("rejects a name that picks out another host", () => {
    expect(namesHost("ep-loud-river", host)).toBe(false);
  });

  it("confirms nothing when the variable is unset", () => {
    expect(namesHost(undefined, host)).toBe(false);
  });

  it("confirms nothing when the variable is set but empty, which every hostname includes", () => {
    // `EVAL_HOST= pnpm eval:refusals`, or a CI variable defined with no value.
    expect(namesHost("", host)).toBe(false);
    expect(namesHost("  ", host)).toBe(false);
  });
});
