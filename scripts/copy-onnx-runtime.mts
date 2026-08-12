/**
 * Copies the ONNX Runtime WASM into `public/onnx/`, so local inference loads it
 * from this origin instead of `cdn.jsdelivr.net`.
 *
 * Measured: without this, a real embedding run fetches
 * `onnxruntime-web@…-dev…/ort-wasm-simd-threaded.asyncify.wasm` from jsDelivr —
 * **executable code from a third party**, which is a heavier thing to put in
 * `connect-src` than the public model files on Hugging Face. Serving it
 * ourselves keeps the remote hosts to weights alone (ADR 032).
 *
 * Generated rather than committed: 74 MB of binaries do not belong in git, and
 * the version has to track the installed `onnxruntime-web` exactly.
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Resolved through `@huggingface/transformers`, because `onnxruntime-web` is a
 * transitive dependency: pnpm keeps it out of the root `node_modules`, so a bare
 * resolve fails, and its version-stamped store path changes on every bump.
 */
const transformers = require.resolve("@huggingface/transformers");
const source = dirname(createRequire(transformers).resolve("onnxruntime-web"));
const target = join(import.meta.dirname, "..", "public", "onnx");

/**
 * All four variants, because which one loads is the runtime's choice and it is
 * not the obvious one. Measured on this build: with `device: "webgpu"` the
 * browser fetches **`asyncify`**, not `jsep` — onnxruntime-web 1.22 replaced the
 * JS-based WebGPU backend with a native one that needs Asyncify or JSPI, and
 * transformers.js defaults `wasmPaths` to the asyncify pair for every non-Safari
 * browser. Shipping the file that sounds right would have served a 404 to the
 * path local mode actually takes.
 */
const WANTED = /^ort-wasm-simd-threaded\.[\w.]*(wasm|mjs)$/;

await mkdir(target, { recursive: true });

const files = (await readdir(source)).filter((name) => WANTED.test(name));

if (files.length === 0) {
  throw new Error(`No ONNX runtime files matched in ${source}`);
}

await Promise.all(
  files.map((name) => copyFile(join(source, name), join(target, name))),
);

console.log(
  `onnx runtime: copied ${String(files.length)} files to public/onnx`,
);
