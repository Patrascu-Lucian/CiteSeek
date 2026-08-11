import { beforeEach, describe, expect, it, vi } from "vitest";

const extract = vi.hoisted(() => vi.fn());
const pipeline = vi.hoisted(() => vi.fn());

const env = vi.hoisted(() => ({
  backends: { onnx: { wasm: { wasmPaths: "" } } },
}));

vi.mock("@huggingface/transformers", () => ({ env, pipeline }));

beforeEach(() => {
  vi.resetModules();
  extract.mockReset();
  pipeline.mockReset();
  pipeline.mockResolvedValue(extract);
  extract.mockResolvedValue({ tolist: () => [[0.1, 0.2]] });
});

/** Re-imported per test because the loaded pipeline is module-level state. */
const load = async () => (await import("./embedder")).localEmbedder;

describe("localEmbedder", () => {
  it("instructs the model when the text is a question", async () => {
    // bge is asymmetric through an instruction rather than a parameter. Sending
    // a query without it costs recall and fails nothing, which is why the two
    // task types are asserted separately.
    const embed = await load();

    await embed(["When is reimbursement paid?"], "RETRIEVAL_QUERY");

    expect(extract).toHaveBeenCalledWith(
      [
        "Represent this sentence for searching relevant passages: When is reimbursement paid?",
      ],
      { pooling: "mean", normalize: true },
    );
  });

  it("leaves a passage exactly as it was stored", async () => {
    const embed = await load();

    await embed(
      ["Reimbursement is paid within 30 days."],
      "RETRIEVAL_DOCUMENT",
    );

    expect(extract).toHaveBeenCalledWith(
      ["Reimbursement is paid within 30 days."],
      { pooling: "mean", normalize: true },
    );
  });

  it("reports no tokens, because nobody is billed for this", async () => {
    // An estimate here would put invented numbers in the usage dashboard.
    const embed = await load();

    expect(await embed(["anything"], "RETRIEVAL_DOCUMENT")).toEqual({
      vectors: [[0.1, 0.2]],
      tokens: 0,
    });
  });

  it("loads the runtime from this origin, not a CDN", async () => {
    // The default fetches a dev-tagged WASM build from jsDelivr. ADR 032.
    const embed = await load();

    await embed(["anything"], "RETRIEVAL_DOCUMENT");

    expect(env.backends.onnx.wasm.wasmPaths).toBe("/onnx/");
  });

  it("loads the weights once across calls", async () => {
    // Tens of megabytes. Reloading per ingest and per question is the difference
    // between local mode being usable and not.
    const embed = await load();

    await embed(["one"], "RETRIEVAL_DOCUMENT");
    await embed(["two"], "RETRIEVAL_QUERY");

    expect(pipeline).toHaveBeenCalledTimes(1);
  });

  it("pins the model, since stored vectors only compare to their own", async () => {
    const { LOCAL_EMBEDDING_MODEL, LOCAL_EMBEDDING_DIMENSIONS } =
      await import("./embedder");

    expect(LOCAL_EMBEDDING_MODEL).toBe("Xenova/bge-small-en-v1.5");
    expect(LOCAL_EMBEDDING_DIMENSIONS).toBe(384);
  });
});

describe("resolveLocalEmbedder", () => {
  it("returns the real model when nothing has flagged otherwise", async () => {
    // The default has to be the real one: a fake that shipped would write
    // word-overlap vectors into a reader's browser and mark them ready.
    delete (globalThis as { __citeseekLocalEmbedder?: string })
      .__citeseekLocalEmbedder;

    const { resolveLocalEmbedder, localEmbedder } = await import("./embedder");

    expect(await resolveLocalEmbedder()).toBe(localEmbedder);
  });

  it("returns the fake only when explicitly flagged", async () => {
    (
      globalThis as { __citeseekLocalEmbedder?: string }
    ).__citeseekLocalEmbedder = "fake";

    const { resolveLocalEmbedder } = await import("./embedder");
    const { fakeLocalEmbedder } = await import("./fake-embedder");

    expect(await resolveLocalEmbedder()).toBe(fakeLocalEmbedder);
  });
});
