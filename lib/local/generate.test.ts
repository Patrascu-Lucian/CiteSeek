import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatSource } from "@/lib/ai/types";

const pipeline = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => ({
  backends: { onnx: { wasm: { wasmPaths: "" } } },
}));
const streamerOptions = vi.hoisted(
  (): { callback_function?: (text: string) => void } => ({}),
);

vi.mock("@huggingface/transformers", () => ({
  env,
  pipeline,
  AutoTokenizer: { from_pretrained: () => Promise.resolve({}) },
  TextStreamer: class {
    constructor(
      _tokenizer: unknown,
      options: { callback_function?: (text: string) => void },
    ) {
      streamerOptions.callback_function = options.callback_function;
    }
  },
}));

const source: ChatSource = {
  marker: 1,
  chunkId: "c1",
  documentId: "d1",
  filename: "handbook.pdf",
  pageNumber: 1,
  charStart: 0,
  charEnd: 20,
  quote: "Reimbursement is paid within thirty days of approval.",
};

/** Answers by driving the streamer's callback, which is how transformers.js
 * emits tokens — there is no async iterator to await. */
const generatingModel = (chunks: string[]) =>
  vi.fn((_messages: unknown, _options: unknown) => {
    for (const chunk of chunks) streamerOptions.callback_function?.(chunk);

    return Promise.resolve([]);
  });

beforeEach(() => {
  vi.resetModules();
  pipeline.mockReset();
  env.backends.onnx.wasm.wasmPaths = "";
  delete (globalThis as { __citeseekLocalEmbedder?: string })
    .__citeseekLocalEmbedder;
});

describe("the local chat model", () => {
  it("states a download size, because the gate promises one", async () => {
    const { LOCAL_CHAT_MODEL, LOCAL_CHAT_MODEL_MB } =
      await import("./generate");

    expect(LOCAL_CHAT_MODEL).toBe("onnx-community/Qwen2.5-0.5B-Instruct");
    expect(LOCAL_CHAT_MODEL_MB).toBe(756);
  });

  it("loads the runtime from this origin, not a CDN", async () => {
    pipeline.mockResolvedValue(vi.fn());
    const { loadChatModel } = await import("./generate");

    await loadChatModel();

    expect(env.backends.onnx.wasm.wasmPaths).toBe("/onnx/");
  });

  it("loads the weights once across questions", async () => {
    pipeline.mockResolvedValue(vi.fn());
    const { loadChatModel } = await import("./generate");

    await loadChatModel();
    await loadChatModel();

    expect(pipeline).toHaveBeenCalledTimes(1);
  });

  it("lets a failed load be retried", async () => {
    // `??=` alone caches the rejection, and one dropped connection during a
    // 756 MB download would make every later attempt fail instantly.
    pipeline.mockRejectedValueOnce(new Error("offline"));
    pipeline.mockResolvedValue(vi.fn());
    const { loadChatModel } = await import("./generate");

    await expect(loadChatModel()).rejects.toThrow("offline");
    await expect(loadChatModel()).resolves.toBeDefined();
  });
});

describe("generateLocally", () => {
  it("streams the deltas the model emits", async () => {
    pipeline.mockResolvedValue(
      generatingModel(["Within ", "thirty days [1]."]),
    );
    const { generateLocally } = await import("./generate");

    const deltas: string[] = [];
    for await (const delta of generateLocally("when?", [source])) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["Within ", "thirty days [1]."]);
  });

  it("sends the shared system prompt, not a second copy of the rules", async () => {
    // Retyping them here would let the citation rules, the injection defense
    // and the refusal wording drift between modes.
    const model = generatingModel(["ok"]);
    pipeline.mockResolvedValue(model);
    const { generateLocally } = await import("./generate");

    for await (const _ of generateLocally("when?", [source]));

    const messages = model.mock.calls[0]![0] as {
      role: string;
      content: string;
    }[];
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("[1]");
  });

  it("shows the model a worked example, since the rule alone does not work", async () => {
    // Measured: with the system prompt only, neither the 0.5B nor the 1.5B
    // model emitted a marker. One example fixed it. ADR 033.
    const model = generatingModel(["ok"]);
    pipeline.mockResolvedValue(model);
    const { generateLocally } = await import("./generate");

    for await (const _ of generateLocally("when?", [source]));

    const messages = model.mock.calls[0]![0] as {
      role: string;
      content: string;
    }[];
    expect(messages.at(-2)?.role).toBe("assistant");
    expect(messages.at(-2)?.content).toMatch(/\[1\]/);
    expect(messages.at(-1)).toEqual({ role: "user", content: "when?" });
  });
});

describe("the stand-in generator", () => {
  it("is chosen by the same flag that swaps the embedder", async () => {
    (
      globalThis as { __citeseekLocalEmbedder?: string }
    ).__citeseekLocalEmbedder = "fake";
    const { resolveLocalGenerator, generateLocally, localGeneratorIsFake } =
      await import("./generate");

    expect(localGeneratorIsFake()).toBe(true);
    expect(resolveLocalGenerator()).not.toBe(generateLocally);
  });

  it("is not used unless something asked for it", async () => {
    const { resolveLocalGenerator, generateLocally } =
      await import("./generate");

    expect(resolveLocalGenerator()).toBe(generateLocally);
  });

  it("cites the passage it was given, so the citation path is exercised", async () => {
    (
      globalThis as { __citeseekLocalEmbedder?: string }
    ).__citeseekLocalEmbedder = "fake";
    const { resolveLocalGenerator } = await import("./generate");

    let answer = "";
    for await (const delta of resolveLocalGenerator()("when?", [source])) {
      answer += delta;
    }

    expect(answer).toContain("[1]");
    expect(answer).toContain("Reimbursement is paid");
  });
});

describe("the download progress the gate reports", () => {
  it("reports percent as the weights arrive", async () => {
    pipeline.mockImplementation(
      (
        _task: string,
        _model: string,
        options: {
          progress_callback?: (r: {
            status?: string;
            loaded?: number;
            total?: number;
          }) => void;
        },
      ) => {
        options.progress_callback?.({
          status: "progress",
          loaded: 50,
          total: 200,
        });
        options.progress_callback?.({ status: "done" });
        return Promise.resolve(vi.fn());
      },
    );
    const { loadChatModel } = await import("./generate");
    const seen: { loaded: number; total: number }[] = [];

    await loadChatModel((progress) => seen.push(progress));

    expect(seen).toEqual([{ loaded: 50, total: 200 }]);
  });
});

describe("a generator that answers after a pause", () => {
  it("waits rather than ending the stream early", async () => {
    // The bridge from a callback to an async iterator: with no deltas queued it
    // has to park until one arrives, or the answer is cut off at the first gap.
    pipeline.mockResolvedValue(
      vi.fn(() => {
        setTimeout(() => streamerOptions.callback_function?.("late"), 5);
        return new Promise((resolve) => setTimeout(resolve, 20));
      }),
    );
    const { generateLocally } = await import("./generate");

    const deltas: string[] = [];
    for await (const delta of generateLocally("when?", [source])) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["late"]);
  });
});

describe("the stand-in with nothing retrieved", () => {
  it("does not invent a marker for a passage that is not there", async () => {
    (
      globalThis as { __citeseekLocalEmbedder?: string }
    ).__citeseekLocalEmbedder = "fake";
    const { resolveLocalGenerator } = await import("./generate");

    let answer = "";
    for await (const delta of resolveLocalGenerator()("when?", [])) {
      answer += delta;
    }

    expect(answer).toBe("According to the document,  [1].");
  });
});
