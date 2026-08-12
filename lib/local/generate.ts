import { buildSystemPrompt } from "@/lib/ai/prompt";
import type { ChatSource } from "@/lib/ai/types";

/** Pinned like the embedder: an answer's quality is a property of this exact
 * model, and the download is the reader's to consent to. */
export const LOCAL_CHAT_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";

/** Measured from the cached files: 749.7 MB of weights plus a 6.7 MB tokenizer.
 * Stated before a byte is fetched, which is the whole point of the gate. */
export const LOCAL_CHAT_MODEL_MB = 756;

/**
 * A worked example, not extra rules. Measured: with the system prompt alone —
 * whose rule 2 already says to cite inline — neither the 0.5B nor the 1.5B model
 * emitted a single marker. One example produced `[1]` from the 0.5B immediately.
 * Instruction-following at this size comes from demonstration, not instruction.
 */
const MARKER_EXAMPLE = [
  {
    role: "user",
    content:
      "Example. Passage [1] says the office closes at six. Q: When does it close?",
  },
  { role: "assistant", content: "It closes at six [1]." },
] as const;

type Message = { role: string; content: string };

type Generator = (
  messages: Message[],
  options: Record<string, unknown>,
) => Promise<unknown>;

let loading: Promise<Generator> | null = null;

export type LoadProgress = { loaded: number; total: number };

/**
 * Cached across questions, and cleared on failure — `??=` alone would keep a
 * rejected promise and make every retry fail instantly (the same defect the
 * embedder had).
 */
export function loadChatModel(
  onProgress?: (progress: LoadProgress) => void,
): Promise<Generator> {
  loading ??= import("@huggingface/transformers")
    .then(({ env, pipeline }) => {
      env.backends.onnx.wasm!.wasmPaths = "/onnx/";

      return pipeline("text-generation", LOCAL_CHAT_MODEL, {
        dtype: "q4",
        // Named, or transformers.js falls back to `DEFAULT_DEVICE`, which is
        // `wasm` in a browser — and `WebGpuGate` would then be denying a feature
        // that runs without a GPU.
        device: "webgpu",
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
    .catch((cause: unknown) => {
      loading = null;
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

  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text: string) => {
      deltas.push(text);
      resolveNext?.();
    },
  });

  const running = generate(
    [
      { role: "system", content: buildSystemPrompt(sources) },
      ...MARKER_EXAMPLE,
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
