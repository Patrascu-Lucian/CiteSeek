import { describe, expect, it } from "vitest";

import { buttonVariants } from "./button";

const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

describe("the variants", () => {
  it("gives the default a background the outline does not share", () => {
    // `data-variant` proves a prop was passed, not that primary looks primary.
    // The sign-in page's email button depends on this difference.
    const background = (variant: "default" | "outline") =>
      buttonVariants({ variant })
        .split(" ")
        .filter((c) => c.startsWith("bg-"));

    expect(background("default")).toContain("bg-primary");
    expect(background("outline")).not.toContain("bg-primary");
    expect(background("default")).not.toEqual(background("outline"));
  });
});

describe("the icon sizes", () => {
  /* A `size-*` utility sets both axes at once. Reaching for a text size instead
     is what made the delete control a rectangle: `sm` is `h-7 px-2.5`, which
     grows with whatever sits inside it. */
  it.each(ICON_SIZES)("gives %s a square box", (size) => {
    const classes = buttonVariants({ size }).split(" ");

    expect(classes).toContainEqual(expect.stringMatching(/^size-\d/));
    expect(classes).not.toContainEqual(expect.stringMatching(/^(h|w|px|py)-/));
  });

  it("keeps them distinct, so a caller can pick a weight", () => {
    const boxes = ICON_SIZES.map((size) =>
      buttonVariants({ size })
        .split(" ")
        .find((c) => /^size-\d/.test(c))!,
    );

    expect(new Set(boxes).size).toBe(ICON_SIZES.length);
  });
});
