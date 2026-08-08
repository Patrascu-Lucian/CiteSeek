import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { type LanguageModel, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * The same argument as `fake-embedder.ts`, one layer up: CI has no key and cannot
 * depend on a live model that is rate-limited and occasionally down.
 *
 * Produces a grounded-looking answer citing `[1]` — enough to assert markers
 * become chips, chips open the panel, and the payload survives the round trip.
 * Says nothing about answer quality.
 *
 * Built on the SDK's own mock: the language-model interface belongs to the SDK,
 * and a hand-rolled version would drift silently on upgrade while compiling.
 */

/** The answer the fake always gives. Cites [1] so the citation path is exercised. */
export const FAKE_ANSWER =
  "According to the retrieved passage, this is a grounded answer [1].";

/** Many small pieces: a single-chunk stream lets a broken streaming surface look
 * correct in a screenshot and wrong in use. */
function answerChunks(answer: string): string[] {
  return answer.split(/(?<=\s)/);
}

/** `chunkDelayMs` exists for one test: a stream still in flight when the caller
 * goes away. At 0 the stream can finish before the abort lands, which makes such
 * a test prove nothing. */
export function fakeChatModel(
  answer: string = FAKE_ANSWER,
  chunkDelayMs = 0,
): LanguageModel {
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
      // `unified` is the cross-provider reason, `raw` what the vendor sent. A bare
      // "stop" streams fine and fails to compile — the right way round.
      finishReason: { unified: "stop" as const, raw: undefined },
      // Zeroed: a fake reporting usage would put fictional numbers into the usage
      // dashboard.
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
    },
  ];

  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        // Zero by default: a test that waits out a simulated typing speed is a
        // slow test, not a realistic one.
        stream: simulateReadableStream({
          chunks,
          chunkDelayInMs: chunkDelayMs,
        }),
      }),
  });
}
