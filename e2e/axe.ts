import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * WCAG 2.2 AA, the bar the project claims. `best-practice` is excluded: it mixes
 * real issues with opinion, and a suite that fails on an opinion gets ignored.
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Reduced to the rule id, impact and markup: a raw `toEqual([])` prints hundreds
 * of lines and buries the one sentence saying what is wrong. */
export async function violationsOn(page: Page, selector?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_AA);
  const results = await (
    selector ? builder.include(selector) : builder
  ).analyze();

  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.html),
  }));
}

/** The cookie the server reads, so the palette is right on the first byte
 * (ADR 018) — a reload would be a second request rather than a repaint. */
export async function useTheme(page: Page, theme: "light" | "dark") {
  // One navigation first, so the context has an origin to attach a cookie to.
  await page.goto("/");
  await page
    .context()
    .addCookies([{ name: "citeseek_theme", value: theme, url: page.url() }]);
}
