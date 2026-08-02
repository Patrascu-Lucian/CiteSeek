import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The dark palette is written twice, and this is what stops the two drifting.
 *
 * `.dark` is set by the server from a cookie — an explicit choice, no
 * JavaScript, no flash. The `prefers-color-scheme` block covers everyone who has
 * not chosen. **A media query is not a selector**, so there is no way to write
 * one rule matching both; the duplication is forced by CSS rather than chosen.
 *
 * What makes duplication dangerous is that it fails silently and late: add a
 * token to one block and the app looks correct in whichever mode you happened to
 * be testing, while readers in the other get an unstyled fragment of a
 * component. Nothing renders an error. This test is the reason that cannot ship.
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
      The bug this caught. The variant was written as `&:is(.dark *)` alone,
      which covers the explicit cookie-set class and silently misses the
      system-preference path. `dark:` utilities are used throughout the shadcn
      components — `dark:bg-input/30`, `dark:border-input`,
      `dark:hover:bg-muted/50` — so a reader arriving by operating-system
      preference would have got the dark palette with every one of those rules
      inert: light component styling over a dark background, on the path most
      readers take, and invisible to any test that sets the cookie.
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
