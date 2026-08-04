import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The dark palette is written twice — **a media query is not a selector**, so the
 * duplication is forced rather than chosen — and this is what stops the two
 * drifting. Adding a token to one block fails silently: the app looks right in
 * whichever mode you tested, and the other gets an unstyled fragment.
 */

const CSS = readFileSync(join(import.meta.dirname, "globals.css"), "utf8");

/** Every `--name: value` pair inside the first block matching `selector`. */
function tokensIn(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  expect(start, `no block for ${selector}`).toBeGreaterThan(-1);

  const open = CSS.indexOf("{", start);
  const body = CSS.slice(open + 1, CSS.indexOf("\n  }", open) + 1);

  const tokens = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = /^\s*(--[\w-]+):\s*(.+);\s*$/.exec(line);
    if (match) tokens.set(match[1]!, match[2]!.trim());
  }

  return tokens;
}

describe("the two dark palettes", () => {
  const explicit = tokensIn("\n.dark {");
  const system = tokensIn(":root:not(.light) {");

  it("both exist and are not empty", () => {
    expect(explicit.size).toBeGreaterThan(20);
    expect(system.size).toBe(explicit.size);
  });

  it("define exactly the same variables", () => {
    expect([...system.keys()].sort()).toEqual([...explicit.keys()].sort());
  });

  it("give them the same values", () => {
    // A token defined in both but with different values is the worse failure:
    // the app works in both modes and is subtly wrong in one.
    for (const [name, value] of explicit) {
      expect(system.get(name), `${name} differs between the two blocks`).toBe(
        value,
      );
    }
  });
});

describe("the light choice can beat a dark operating system", () => {
  it("scopes the media query with :not(.light)", () => {
    /*
      Without this, a reader whose OS is dark could never choose light here: the
      media query would repaint over the explicit choice and the toggle would
      look broken on exactly the machines where it matters.
    */
    expect(CSS).toContain(":root:not(.light)");
  });

  it("applies the dark variant on both paths into the dark palette", () => {
    /*
      The bug this caught: the variant was `&:is(.dark *)` alone, covering the
      cookie class and silently missing the system path — so those readers got the
      dark palette with every `dark:` utility inert, and no test that sets the
      cookie could see it.
    */
    const variant = CSS.slice(
      CSS.indexOf("@custom-variant dark"),
      CSS.indexOf("@theme inline"),
    );

    expect(variant).toContain(".dark *");
    expect(variant).toContain("prefers-color-scheme: dark");
    expect(variant).toContain(":root:not(.light) *");
  });

  it("keeps the dark variant matching descendants, not the root itself", () => {
    // `&:is(.dark *)` matches *descendants* of `.dark`. With the class on
    // `<html>`, `body` and everything under it match — which is why the base
    // layer paints `body` rather than `html`. Moving that paint to `html` would
    // leave the page background stuck in the light palette.
    expect(CSS).toContain("&:is(.dark *)");
    expect(CSS).toMatch(/body\s*\{[^}]*bg-background/);
  });
});
