import { describe, expect, it } from "vitest";

import { cites, grounds } from "./scoring";

describe("grounds", () => {
  it("does not read a value out of a longer number", () => {
    // The defect that produced it: "credits 5% … capped at 25%" scored the cap
    // as the rate, from one sentence.
    expect(grounds("capped at 25% in any month", ["5%"])).toBe(false);
    expect(grounds("credits 5% of the monthly fee", ["5%"])).toBe(true);
  });

  it("guards the trailing edge too, where a wrong answer looks right", () => {
    // The first fix only stopped a value being read out of a *longer prefix*.
    // Ten times the interval, and the wrong unit, both scored correct.
    expect(grounds("every 20000 operating hours", ["2,000", "2000"])).toBe(
      false,
    );
    expect(grounds("the press develops 90 kNm", ["90 kN"])).toBe(false);
    expect(grounds("every 2,000 operating hours", ["2,000"])).toBe(true);
  });

  it("accepts any of the spellings", () => {
    expect(grounds("about 90 kN of force", ["90 kilonewtons", "90 kN"])).toBe(
      true,
    );
  });

  it("treats the wanted string as text, not a pattern", () => {
    expect(grounds("the cap is 25 percent", ["25%"])).toBe(false);
  });

  it("ignores case", () => {
    expect(grounds("USE ISO VG 46 OIL", ["ISO VG 46"])).toBe(true);
  });
});

describe("cites", () => {
  it("counts a marker the source list can resolve", () => {
    expect(cites("the deposit is five weeks [2].", 3)).toBe(true);
  });

  it("rejects a marker past the end of the list", () => {
    expect(cites("the deposit is five weeks [9].", 3)).toBe(false);
  });

  it("rejects a zero, which no passage carries", () => {
    expect(cites("see [0]", 3)).toBe(false);
  });

  it("finds nothing in an uncited answer", () => {
    expect(cites("The press develops 90 kilonewtons.", 8)).toBe(false);
  });
});
