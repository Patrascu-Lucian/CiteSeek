import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { type LanguageModel, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * The same argument as `fake-embedder.ts`, one layer up: CI has no key. Answers
 * with a `[1]`, enough for markers becoming chips and the round trip — nothing
 * about quality. Built on the SDK's own mock, since a hand-rolled one would drift
 * silently on upgrade while still compiling.
 */

/** The answer the fake always gives. Cites [1] so the citation path is exercised. */
export const FAKE_ANSWER =
  "According to the retrieved passage, this is a grounded answer [1].";

/** Many small pieces: a single-chunk stream lets a broken streaming surface look
 * correct in a screenshot and wrong in use. */
function answerChunks(answer: string): string[] {
  return answer.split(/(?<=\s)/);
}

/** `chunkDelayMs` exists for one test: at 0 a stream finishes before an abort can
 * land, so the abort proves nothing. */
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
    // Not every call streams: the follow-up rewrite uses `generateText`, and a
    // fake missing this fails the whole turn rather than the rewrite.
    doGenerate: () =>
      Promise.resolve({
        content: [{ type: "text" as const, text: answer }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
      }),
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
