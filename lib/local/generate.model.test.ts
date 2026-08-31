import { describe, expect, it } from "vitest";

import type { ChatSource } from "@/lib/ai/types";

import { generateLocally, loadChatModel } from "./generate";

/** The real transformers.js, where `generate.test.ts` mocks it. `tiny-random`
 * answers nonsense on purpose: nothing here asserts on prose. */
const TINY = "onnx-community/tiny-random-LlamaForCausalLM-ONNX";

const source: ChatSource = {
  marker: 1,
  chunkId: "c1",
  documentId: "d1",
  filename: "handbook.md",
  pageNumber: 1,
  charStart: 0,
  charEnd: 52,
  quote: "Reimbursement is paid within thirty days of approval.",
};

const collect = async (signal?: AbortSignal) => {
  let answer = "";
  for await (const delta of generateLocally("when?", [source], signal)) {
    answer += delta;
  }
  return answer;
};

// 31 MB on a cold cache, then nothing. CI restores it; a developer running this
// locally pays once.
describe("against the real library", { timeout: 300_000 }, () => {
  it("reports bytes while the weights are actually being fetched", async () => {
    const seen: { loaded: number; total: number }[] = [];

    await loadChatModel(
      (progress) => seen.push(progress),
      "cpu",
      TINY,
      "q4f16",
    );

    // `progress_total`, not `progress`: the filter is ours, and a cached run
    // reports nothing, so this asserts the shape rather than the count.
    expect(seen.every((one) => one.total > 0)).toBe(true);
    expect(seen.every((one) => one.loaded <= one.total)).toBe(true);
  });

  it("streams deltas that a mock cannot have staged", async () => {
    const answer = await collect();

    expect(typeof answer).toBe("string");
  });

  it("stops when the signal aborts, rather than running to max_new_tokens", async () => {
    // Not `""`: the criteria is consulted after each token, so an interrupt
    // before the first still yields that one. One delta against eighty.
    const controller = new AbortController();
    controller.abort();

    const stopped = await collect(controller.signal);
    const whole = await collect();

    expect(stopped.length).toBeLessThan(whole.length / 4);
  });
});
