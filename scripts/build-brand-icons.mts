/**
 * Regenerates the app icons from `brand/mark.svg`. Run by hand, never in CI —
 * same trade as `demo:pdf`, which explains it.
 *
 * A favicon is drawn as-is, so its corners are rounded and transparent. iOS masks
 * `apple-icon` itself, so rounding that one would round it twice.
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "scripts", "brand", "mark.svg");

/** 180 is Apple's stated size; 512 leaves a retina tab pixels to downscale. */
const OUTPUTS = [
  { file: join(ROOT, "app", "icon.png"), size: 512, rounded: true },
  { file: join(ROOT, "app", "apple-icon.png"), size: 180, rounded: false },
];

const svg = await readFile(SOURCE, "utf8");

const browser = await chromium.launch();
try {
  for (const { file, size, rounded } of OUTPUTS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });

    // The override follows the SVG so it wins on order alone.
    await page.setContent(
      `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>` +
        svg +
        (rounded ? "" : "<style>.ground{rx:0}</style>"),
      { waitUntil: "load" },
    );

    await writeFile(
      file,
      await page.screenshot({ type: "png", omitBackground: rounded }),
    );
    await page.close();

    console.log(`Wrote ${file} at ${size}px${rounded ? "" : ", square"}.`);
  }
} finally {
  await browser.close();
}
