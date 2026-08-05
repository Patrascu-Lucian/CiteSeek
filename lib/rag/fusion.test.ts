import { describe, expect, it } from "vitest";

import { fuse, RRF_K } from "./fusion";

const item = (id: string) => ({ id });

describe("fuse", () => {
  it("ranks agreement above either list's first place", () => {
    // The property RRF is chosen for: a passage both signals like beats one that
    // only one signal saw, however confident that one signal was.
    const fused = fuse({
      vector: [item("a"), item("b")],
      lexical: [item("c"), item("b")],
    });

    expect(fused[0]?.item.id).toBe("b");
  });

  it("keeps a result only one list found", () => {
    // Lexical search returns nothing for a question phrased without the
    // document's words, and dropping the vector hits then would make hybrid
    // strictly worse than vector alone.
    const fused = fuse({ vector: [item("a")], lexical: [] });

    expect(fused.map((one) => one.item.id)).toEqual(["a"]);
  });

  it("scores a rank-1 hit as 1/(k+1)", () => {
    const [top] = fuse({ vector: [item("a")] });

    expect(top?.score).toBeCloseTo(1 / (RRF_K + 1));
  });

  it("records where each result came from", () => {
    // What makes a fused result explainable: "second on both" is a different
    // fact from "first on one and unseen by the other".
    const fused = fuse({
      vector: [item("x"), item("y")],
      lexical: [item("y")],
    });

    expect(fused.find((one) => one.item.id === "y")?.ranks).toEqual({
      vector: 2,
      lexical: 1,
    });
  });

  it("drops a list weighted to zero", () => {
    // How the evaluation compares against vector-only without a second code path.
    const fused = fuse(
      { vector: [item("a")], lexical: [item("b")] },
      { lexical: 0 },
    );

    expect(fused.map((one) => one.item.id)).toEqual(["a"]);
  });

  it("lets a weight settle a disagreement between the lists", () => {
    const louder = fuse(
      { vector: [item("v")], lexical: [item("l")] },
      { vector: 1, lexical: 2 },
    );

    expect(louder[0]?.item.id).toBe("l");
  });

  it("is empty for empty input, rather than throwing", () => {
    expect(fuse({ vector: [], lexical: [] })).toEqual([]);
  });

  it("does not let one long list outweigh agreement", () => {
    // 1/(60+1) + 1/(60+1) for the agreed passage against 1/(60+1) for a first
    // place seen once. Damping is what stops a list's length buying rank.
    const fused = fuse({
      vector: [item("solo"), item("both")],
      lexical: [item("both")],
    });

    expect(fused[0]?.item.id).toBe("both");
  });
});
