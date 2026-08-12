import {
  createUIMessageStream,
  type ChatTransport,
  type UIMessageChunk,
} from "ai";

import { NO_RELEVANT_PASSAGES_REPLY } from "@/lib/ai/prompt";
import {
  REFUSAL_PART_ID,
  SOURCES_PART_ID,
  type ChatUIMessage,
} from "@/lib/ai/types";

import { retrieveLocally } from "./retrieve";

/** Streams the answer for a question, given the passages retrieval kept. */
export type LocalGenerator = (
  question: string,
  sources: Awaited<ReturnType<typeof retrieveLocally>>["sources"],
) => AsyncIterable<string>;

/**
 * The local half of ADR 011's ordering: sources are written **before**
 * generation starts, so a marker resolves against a payload that already exists
 * and the model chooses which passage to cite rather than inventing one. Getting
 * this backwards would make the project's headline guarantee true in cloud mode
 * only.
 */
export function localAnswerStream(
  question: string,
  generate: LocalGenerator,
): ReadableStream<UIMessageChunk> {
  return createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      const { sources, refusal } = await retrieveLocally(question);

      if (refusal) {
        // The same shape a real answer takes, so the client has one code path,
        // and fixed text with no model call — which is what makes "I don't
        // know" structural rather than instructed.
        writer.write({
          type: "data-refusal",
          id: REFUSAL_PART_ID,
          data: { reason: refusal },
        });
        writer.write({ type: "text-start", id: "0" });
        writer.write({
          type: "text-delta",
          id: "0",
          delta: NO_RELEVANT_PASSAGES_REPLY,
        });
        writer.write({ type: "text-end", id: "0" });

        return;
      }

      writer.write({
        type: "data-sources",
        id: SOURCES_PART_ID,
        data: sources,
      });

      writer.write({ type: "text-start", id: "0" });

      for await (const delta of generate(question, sources)) {
        writer.write({ type: "text-delta", id: "0", delta });
      }

      writer.write({ type: "text-end", id: "0" });
    },
  });
}

/**
 * What `useChat` talks to in local mode. Nothing here reaches the network: the
 * same `UIMessageChunk`s the route emits are produced in this tab, so the
 * citation chips, source panel and refusal copy work unchanged.
 */
export class LocalChatTransport implements ChatTransport<ChatUIMessage> {
  constructor(private readonly generate: LocalGenerator) {}

  sendMessages({
    messages,
  }: {
    messages: ChatUIMessage[];
  }): Promise<ReadableStream<UIMessageChunk>> {
    return Promise.resolve(
      localAnswerStream(questionFrom(messages), this.generate),
    );
  }

  /** Nothing to reconnect to: the stream never left this tab, so a reload has
   * no server-side turn to resume. */
  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}

function questionFrom(messages: ChatUIMessage[]): string {
  const last = messages.at(-1);

  return (last?.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
