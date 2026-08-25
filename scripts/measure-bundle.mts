/**
 * What a page actually ships, read from the HTML it serves rather than from the
 * build summary — Next's "First Load JS" counts a route's graph, not the tags in
 * the document, and the two disagreed by 428 KB once (README, Milestone 3).
 *
 * Raw is what parses; transferred is what crosses the wire, so both are reported.
 */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";

const base = process.env.MEASURE_BASE_URL ?? "http://localhost:3000";
const path = process.argv[2] ?? "/";

/** `/demo` mints the guest cookie and redirects; `proxy.ts` sends a
 * credential-less `/w/*` to sign-in, which would measure a different page. */
async function guestCookie(): Promise<string> {
  const response = await fetch(`${base}/demo`, { redirect: "manual" });
  const cookie = response.headers
    .getSetCookie()
    .map((one) => one.split(";")[0])
    .join("; ");

  const location = response.headers.get("location");
  if (!location) throw new Error("/demo did not redirect.");

  // Without a cookie the guarded route redirects to /sign-in, and following it
  // would size that page under this one's name. `/demo` sends none when the
  // secret or the database is missing.
  if (!cookie) throw new Error("/demo set no cookie — is AUTH_SECRET set?");

  return `${cookie}|${new URL(location, base).pathname}`;
}

const [cookie, demoPath] = (await guestCookie()).split("|") as [string, string];
const target = path === "/w" ? demoPath : path;

const response = await fetch(`${base}${target}`, { headers: { cookie } });

// A redirect or a refusal answers with someone else's page, and measuring it
// under the requested path is the one failure this script must not have.
if (!response.ok) {
  throw new Error(`${target} answered ${String(response.status)}.`);
}
if (new URL(response.url).pathname !== target) {
  throw new Error(`${target} redirected to ${new URL(response.url).pathname}.`);
}

const html = await response.text();

/** Both tags matter: a preloaded chunk is fetched on parse exactly like a
 * `<script src>`, so counting only the latter understates the payload. Turbopack
 * emits `rel="preload" as="script"`, not `modulepreload`. */
const urls = [
  ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
  ...html.matchAll(
    /<link[^>]+rel="preload"[^>]*as="script"[^>]*href="([^"]+)"/g,
  ),
  ...html.matchAll(
    /<link[^>]+as="script"[^>]*rel="preload"[^>]*href="([^"]+)"/g,
  ),
].map((match) => match[1]!);

let raw = 0;
let transferred = 0;
const rows: { file: string; raw: number; transferred: number }[] = [];

for (const url of [...new Set(urls)]) {
  if (!url.startsWith("/_next/")) continue;

  const file = join(".next", url.replace("/_next/", ""));
  // Fatal: a skipped file makes the total smaller and still prints as a
  // measurement. `.next` not matching the running server is the usual cause.
  await stat(file);

  const bytes = await readFile(file);
  const compressed = brotliCompressSync(bytes).byteLength;

  raw += bytes.byteLength;
  transferred += compressed;
  rows.push({ file: url, raw: bytes.byteLength, transferred: compressed });
}

const kb = (bytes: number) => `${String(Math.round(bytes / 1024))} KB`;

rows.sort((a, b) => b.raw - a.raw);
for (const row of rows.slice(0, 8)) {
  console.log(
    `  ${kb(row.raw).padStart(8)}  ${kb(row.transferred).padStart(8)}  ${row.file}`,
  );
}

console.log(
  `\n${target}: ${String(rows.length)} scripts, ${kb(raw)} raw, ${kb(transferred)} transferred`,
);
