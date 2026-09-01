import { beforeAll, describe, expect, it } from "vitest";

import type { ChatSource } from "@/lib/ai/types";

import { generateLocally, loadChatModel, type LoadProgress } from "./generate";

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

const progress: LoadProgress[] = [];

// 31 MB on a cold cache, then nothing. CI restores it; a developer running this
// locally pays once.
describe("against the real library", { timeout: 300_000 }, () => {
  // A hook, so a failed load skips the tests below rather than leaving them to
  // reach `loadChatModel()` with no arguments — the shipped 756 MB on webgpu.
  beforeAll(async () => {
    await loadChatModel((one) => progress.push(one), "cpu", TINY, "q4f16");
  });

  it("reports bytes in a shape the readout can divide", () => {
    // Not "reports bytes": CI restores the cache, so a warm run reports none.
    // What has to hold either way is that a report is usable when it comes.
    expect(progress.every((one) => one.total > 0)).toBe(true);
    expect(progress.every((one) => one.loaded <= one.total)).toBe(true);
  });

  it("streams deltas that a mock cannot have staged", async () => {
    const answer = await collect();

    expect(answer.length).toBeGreaterThan(0);
  });

  it("stops when the signal aborts, rather than running to max_new_tokens", async () => {
    // Not `""`: the criteria is consulted after each token, so an interrupt
    // before the first still yields that one. One delta against eighty.
    const controller = new AbortController();
    controller.abort();

    const stopped = await collect(controller.signal);
    const whole = await collect();

    expect(whole.length).toBeGreaterThan(20);
    expect(stopped.length).toBeLessThan(whole.length / 4);
  });
});
