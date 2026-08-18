import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

/** The icons are generated from the file; this one is drawn in the page. Two
 * copies of one mark, so the geometry is pinned rather than trusted. */
const FILE = readFileSync(
  join(import.meta.dirname, "..", "scripts", "brand", "mark.svg"),
  "utf8",
);

function attribute(source: string, name: string): string {
  const match = new RegExp(`${name}="([^"]+)"`).exec(source);
  expect(match, `no ${name} in mark.svg`).not.toBeNull();
  return match![1]!;
}

describe("BrandMark against the committed mark", () => {
  const { container } = render(<BrandMark />);
  const svg = container.querySelector("svg")!;

  it("draws the same arc", () => {
    expect(svg.querySelector("path")!.getAttribute("d")).toBe(
      attribute(FILE, "d"),
    );
  });

  it("keeps the optical offset that centres it", () => {
    expect(svg.querySelector("path")!.getAttribute("transform")).toBe(
      attribute(FILE, "transform"),
    );
  });

  it("shares the viewBox, or every coordinate above means something else", () => {
    expect(svg.getAttribute("viewBox")).toBe(attribute(FILE, "viewBox"));
  });

  // The wordmark beside it is the accessible name; announcing this repeats it.
  it("is decorative", () => {
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
