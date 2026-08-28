import { buildSystemPrompt } from "@/lib/ai/prompt";
import type { ChatSource } from "@/lib/ai/types";

import { useNodeModelCache } from "./model-cache";

/** Pinned like the embedder: an answer's quality is a property of this exact
 * model, and the download is the reader's to consent to. */
export const LOCAL_CHAT_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";

/** Measured from the cached files: 749.7 MB of weights plus a 6.7 MB tokenizer.
 * Stated before a byte is fetched, which is the whole point of the gate. */
export const LOCAL_CHAT_MODEL_MB = 756;

/**
 * A worked example, because rule 2 alone produced no markers (ADR 033). In the
 * system prompt, never the message array: as `user`/`assistant` turns it was
 * transcript, and "cite" returned the example itself with a resolving marker.
 * Built from the retrieved passage so a parroted example still quotes the
 * reader's own document (ADR 035).
 */
function markerExample(sources: readonly ChatSource[]): string {
  const source = sources[0]!;
  // The first sentence that *starts* one: chunks are cut on character offsets,
  // so a chunk usually opens mid-sentence and the example would demonstrate a
  // fragment — which the model then reproduces as its answer.
  const sentences = source.quote.trim().split(/(?<=[.!?])\s+/);
  const sentence =
    sentences.find((one) => /^[A-Z]/.test(one)) ?? sentences[0] ?? "";

  return [
    "Citation format. An answer taken from the passage marked",
    `[${String(source.marker)}] is written like this:`,
    "",
    `${sentence.slice(0, 200)} [${String(source.marker)}]`,
  ].join("\n");
}

/**
 * Long enough that prose does not repeat it by accident, short enough to catch a
 * loop on its second pass rather than its seventh.
 */
const LOOP_WINDOW = 80;

/**
 * Greedy decoding cannot leave a loop: the model repeated one paragraph seven
 * times until `max_new_tokens` stopped it. Detected here rather than configured —
 * `repetition_penalty` is presence-based over the prompt too, so it changed
 * nothing byte for byte, and `no_repeat_ngram_size` would forbid quoting the
 * passage the prompt asks for. This reads only what was generated.
 */
function isLooping(answer: string): boolean {
  if (answer.length < LOOP_WINDOW * 2) return false;

  return answer.slice(0, -LOOP_WINDOW).includes(answer.slice(-LOOP_WINDOW));
}

type Message = { role: string; content: string };

type Generator = (
  messages: Message[],
  options: Record<string, unknown>,
) => Promise<unknown>;

let loading: Promise<Generator> | null = null;

export type LoadProgress = { loaded: number; total: number };

/** Three states, because `loading !== null` only means a download *started*:
 * rendering the chat over weights still arriving is what this prevents. */
export type ChatModelStatus = "idle" | "loading" | "ready";

let status: ChatModelStatus = "idle";

/** Module state, so it survives a remount: leaving `/local` and coming back
 * must not re-offer a download this tab has already made. */
export function chatModelStatus(): ChatModelStatus {
  return status;
}

/**
 * Cached across questions, and cleared on failure — `??=` alone would keep a
 * rejected promise and make every retry fail instantly (the same defect the
 * embedder had).
 */
export function loadChatModel(
  onProgress?: (progress: LoadProgress) => void,
  // Only `pnpm eval:local-answers` passes anything: Node has no WebGPU, and its
  // build of transformers.js takes `cpu` where a browser takes `wasm`.
  device: "webgpu" | "cpu" = "webgpu",
): Promise<Generator> {
  if (loading === null) status = "loading";

  loading ??= import("@huggingface/transformers")
    .then(({ env, pipeline }) => {
      env.backends.onnx.wasm!.wasmPaths = "/onnx/";
      useNodeModelCache(env);

      return pipeline("text-generation", LOCAL_CHAT_MODEL, {
        dtype: "q4",
        // Named, or transformers.js falls back to `DEFAULT_DEVICE`, which is
        // `wasm` in a browser — and `WebGpuGate` would then be denying a feature
        // that runs without a GPU.
        device,
        // `progress_total`, not `progress`: the latter is per file, so the
        // readout reaches 100% on a 4 KB config before the weights begin.
        progress_callback: (report: {
          status?: string;
          loaded?: number;
          total?: number;
        }) => {
          if (report.status === "progress_total" && report.total) {
            onProgress?.({ loaded: report.loaded ?? 0, total: report.total });
          }
        },
      });
    })
    .then((generate) => {
      status = "ready";
      return generate;
    })
    .catch((cause: unknown) => {
      // Both reset together: a caller offered "try again" has to reach a real
      // retry, and a gate reading `loading` would otherwise sit on a download
      // that is not happening.
      loading = null;
      status = "idle";
      throw cause;
    });

  return loading;
}

/**
 * Streams an answer from the retrieved passages, and only those. The system
 * prompt is `buildSystemPrompt` — the same one the route sends to Gemini — so
 * the citation rules, the injection defense and the refusal wording are defined
 * in one place rather than drifting between modes.
 */
export async function* generateLocally(
  question: string,
  sources: readonly ChatSource[],
  signal?: AbortSignal,
): AsyncIterable<string> {
  const generate = await loadChatModel();

  const deltas: string[] = [];
  let resolveNext: (() => void) | null = null;
  let finished = false;

  const { TextStreamer, AutoTokenizer, InterruptableStoppingCriteria } =
    await import("@huggingface/transformers");
  const tokenizer = await AutoTokenizer.from_pretrained(LOCAL_CHAT_MODEL);

  /* Stopping the consumer is not enough: `useChat`'s stop only cancels the
     stream, and the model would run on to `max_new_tokens` holding the tab
     while the composer re-enables. A second question then starts a concurrent
     generation on the same pipeline. */
  const stopping = new InterruptableStoppingCriteria();

  if (signal?.aborted) stopping.interrupt();
  signal?.addEventListener("abort", () => stopping.interrupt(), { once: true });

  let answer = "";

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text: string) => {
      deltas.push(text);
      answer += text;

      // The same interrupt the Stop button uses: what has already been written
      // still reaches the reader, and the loop stops adding to it.
      if (isLooping(answer)) stopping.interrupt();

      resolveNext?.();
    },
  });

  const running = generate(
    [
      {
        role: "system",
        content: `${buildSystemPrompt(sources)}\n\n${markerExample(sources)}`,
      },
      { role: "user", content: question },
    ],
    {
      max_new_tokens: 320,
      do_sample: false,
      streamer,
      stopping_criteria: stopping,
    },
  ).finally(() => {
    finished = true;
    resolveNext?.();
  });

  while (!finished || deltas.length > 0) {
    if (deltas.length === 0) {
      await new Promise<void>((resolve) => (resolveNext = resolve));
      continue;
    }

    yield deltas.shift()!;
  }

  // Rethrows a generation failure the loop above would otherwise swallow.
  await running;
}

/** True when the stand-in is in use, so the consent gate can skip a download
 * that would not happen. */
export function localGeneratorIsFake(): boolean {
  return (
    (globalThis as { __citeseekLocalEmbedder?: string })
      .__citeseekLocalEmbedder === "fake"
  );
}

export function resolveLocalGenerator(): LocalGeneratorFn {
  return localGeneratorIsFake() ? fakeGenerator : generateLocally;
}

type LocalGeneratorFn = (
  question: string,
  sources: readonly ChatSource[],
  signal?: AbortSignal,
) => AsyncIterable<string>;

/**
 * Swapped by the same flag as the embedder, because a test that fakes one and
 * downloads the other is neither fast nor honest. Deterministic, cites the first
 * passage, and needs no weights — enough to prove the ordering and the citation
 * path on a runner with no GPU and no Hugging Face access.
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function* fakeGenerator(
  _question: string,
  sources: readonly ChatSource[],
  signal?: AbortSignal,
): AsyncIterable<string> {
  yield "According to the document, ";
  if (signal?.aborted) return;
  yield `${sources[0]?.quote.slice(0, 60) ?? ""}`;
  if (signal?.aborted) return;
  yield ` [${String(sources[0]?.marker ?? 1)}].`;
}
