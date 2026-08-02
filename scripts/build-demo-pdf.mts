/**
 * Regenerates the demo workspace's seeded PDF from its HTML source.
 *
 * Run by hand when the handbook's wording changes — `pnpm demo:pdf` — and never
 * by the seed. The seed runs in CI's integration job, which installs no browser,
 * and making it depend on Chromium would trade a committed 30 KB file for a
 * 300 MB download on every run. The generated PDF is committed instead;
 * `.gitattributes` already declares `*.pdf binary`, so it diffs as one line.
 *
 * Chromium via Playwright rather than a PDF library, because Playwright is
 * already installed for the E2E suite. `page.pdf()` emits a real text layer, not
 * an image of one, which is the only kind of PDF worth using here: the whole
 * point is that extraction pulls text and page numbers back out.
 *
 * Uses the browser Playwright already downloaded. If it reports a missing
 * executable, run the E2E suite once rather than `playwright install`.
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "lib",
  "db",
  "fixtures",
);
const SOURCE = join(FIXTURES, "northwind-remote-work-handbook.html");
const OUTPUT = join(FIXTURES, "northwind-remote-work-handbook.pdf");

/** A one-page demo PDF makes every citation "page 1" and proves nothing. */
const MINIMUM_PAGES = 2;

const html = await readFile(SOURCE, "utf8");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();

  // `setContent` rather than a file:// URL so relative paths cannot silently
  // resolve to something outside the fixture.
  await page.setContent(html, { waitUntil: "load" });

  const pdf = await page.pdf({
    format: "A4",
    // The @page rule in the source owns the margins. Printing headers and
    // footers would put a URL and a date into the extracted text, where they
    // would become retrievable passages of the demo corpus.
    printBackground: true,
    displayHeaderFooter: false,
  });

  await writeFile(OUTPUT, pdf);

  // Verified rather than assumed, from the file just written: the page count is
  // the one property of this fixture the demo actually depends on.
  const { getDocumentProxy } = await import("unpdf");
  const parsed = await getDocumentProxy(new Uint8Array(pdf));

  if (parsed.numPages < MINIMUM_PAGES) {
    throw new Error(
      `Generated ${String(parsed.numPages)} page(s); the demo needs at least ` +
        `${String(MINIMUM_PAGES)} so citations can differ by page. Lengthen the source.`,
    );
  }

  console.log(
    `Wrote ${OUTPUT} — ${String(parsed.numPages)} pages, ${String(pdf.length)} bytes.`,
  );
} finally {
  await browser.close();
}

/*
  Note: Chromium stamps a creation timestamp into the PDF, so every run produces
  a byte-different file with identical content. Re-running this dirties the
  working tree even when nothing changed — check the diff is intentional before
  committing it, or restore with `git checkout HEAD -- <path>`.
*/
