import { describe, expect, it } from "vitest";

import { formatLifetime } from "./lifetime";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

describe("formatLifetime", () => {
  it.each([
    [365 * DAY, "a year"],
    [2 * 365 * DAY, "2 years"],
    [30 * DAY, "30 days"],
    [DAY, "a day"],
    [HOUR, "an hour"],
    [15 * 60, "15 minutes"],
    [90, "90 seconds"],
  ])("says %i seconds as %s", (seconds, said) => {
    expect(formatLifetime(seconds)).toBe(said);
  });

  it("never rounds into a larger unit", () => {
    // A page quoting "a day and a half" for a 36-hour cookie would be close,
    // and a notice about how long something is kept has to be exact.
    expect(formatLifetime(36 * HOUR)).toBe("36 hours");
    expect(formatLifetime(400 * DAY)).toBe("400 days");
  });
});
