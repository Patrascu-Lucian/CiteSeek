import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { type LanguageModel, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A deterministic stand-in for a real generation provider.
 *
 * The same argument as `fake-embedder.ts`, one layer up. CI has no API key, E2E
 * runs against a built app, and neither can depend on a live model that is
 * rate-limited, non-deterministic and occasionally down. Without this, the chat
 * path could only ever be exercised by hand.
 *
 * What it produces is a grounded-looking answer that cites `[1]` — enough to
 * assert that markers become chips, that a chip opens the source panel, and that
 * the citation payload survives the round trip. It says nothing about answer
 * quality, which only the real model can be judged on.
 *
 * Built on the SDK's own mock rather than a hand-rolled implementation of the
 * language-model interface: that interface belongs to the SDK and changes with
 * it, and a hand-rolled version would drift silently on upgrade while still
 * compiling.
 */

/** The answer the fake always gives. Cites [1] so the citation path is exercised. */
export const FAKE_ANSWER =
  "According to the retrieved passage, this is a grounded answer [1].";

/**
 * Split after each space, so the stream arrives in many small pieces.
 *
 * A single-chunk stream would let a broken streaming surface still look correct
 * — the text appears, just all at once, which is indistinguishable from a
 * working implementation in a screenshot and very distinguishable in use.
 */
function answerChunks(answer: string): string[] {
  return answer.split(/(?<=\s)/);
}

export function fakeChatModel(answer: string = FAKE_ANSWER): LanguageModel {
  const chunks: LanguageModelV4StreamPart[] = [
    { type: "text-start", id: "0" },
    ...answerChunks(answer).map((delta) => ({
      type: "text-delta" as const,
      id: "0",
      delta,
    })),
    { type: "text-end", id: "0" },
    {
      type: "finish",
      // A struct rather than a bare string: `unified` is the cross-provider
      // reason, `raw` whatever the vendor actually sent. Passing "stop" alone
      // streams fine at runtime and fails to compile, which is the right way
      // round.
      finishReason: { unified: "stop" as const, raw: undefined },
      // v4 reports token counts as breakdowns rather than plain numbers, so
      // cached and reasoning tokens can be billed apart. Zeroed here: a fake
      // model reporting usage would put fictional numbers into the cost
      // dashboard Milestone 5 builds.
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
    },
  ];

  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        // No artificial delay: a test that waits out a simulated typing speed is
        // a slow test, not a realistic one.
        stream: simulateReadableStream({ chunks, chunkDelayInMs: 0 }),
      }),
  });
}
