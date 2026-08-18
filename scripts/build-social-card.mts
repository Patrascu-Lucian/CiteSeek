/**
 * Against a running instance, like `demo:shots`: `next/font` writes Audiowide
 * to a hashed path under `.next`, so the wordmark can only be set in a page
 * that has already loaded it.
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUTPUT = join(ROOT, "app", "opengraph-image.png");

/** The size every platform crops from. */
const WIDTH = 1200;
const HEIGHT = 630;

const mark = await readFile(join(ROOT, "scripts", "brand", "mark.svg"), "utf8");

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  // Light: a card is shown on whatever background the platform has, and the
  // dark palette reads as a hole punched in most of them.
  await context.addCookies([
    { name: "citeseek_theme", value: "light", url: BASE_URL },
  ]);

  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  await page.evaluate(
    ({ svg, width, height }) => {
      const card = document.createElement("div");
      card.id = "social-card";
      card.style.cssText = `position:fixed;inset:0;z-index:9999;width:${width}px;height:${height}px;
        display:flex;flex-direction:column;justify-content:center;gap:36px;padding:0 96px;
        background:var(--background);box-sizing:border-box;overflow:hidden`;

      const wash = document.createElement("div");
      wash.style.cssText = `position:absolute;inset:0;
        background:linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%)`;
      card.append(wash);

      const lockup = document.createElement("div");
      lockup.style.cssText =
        "position:relative;display:flex;align-items:center;gap:24px";
      lockup.innerHTML = `${svg}<span style="font-family:var(--font-wordmark);font-size:76px;letter-spacing:0.04em;color:var(--primary)">CiteSeek</span>`;
      const glyph = lockup.querySelector("svg")!;
      glyph.setAttribute("style", "width:88px;height:88px;display:block");
      card.append(lockup);

      const claim = document.createElement("p");
      claim.textContent = "Ask your documents. Get answers you can verify.";
      claim.style.cssText = `position:relative;margin:0;font-size:56px;line-height:1.15;
        font-weight:600;letter-spacing:-0.02em;color:var(--foreground);max-width:22ch`;
      card.append(claim);

      const note = document.createElement("p");
      note.textContent = "Every claim links back to the passage it came from.";
      note.style.cssText = `position:relative;margin:0;font-size:30px;color:var(--muted-foreground)`;
      card.append(note);

      document.body.append(card);
    },
    { svg: mark, width: WIDTH, height: HEIGHT },
  );

  await writeFile(
    OUTPUT,
    await page.locator("#social-card").screenshot({ type: "png" }),
  );
  console.log(`Wrote ${OUTPUT} at ${WIDTH}x${HEIGHT}.`);
} finally {
  await browser.close();
}
