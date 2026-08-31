import {
  createUIMessageStream,
  type ChatTransport,
  type UIMessageChunk,
} from "ai";

import { NO_RELEVANT_PASSAGES_REPLY } from "@/lib/ai/prompt";
import { questionFrom } from "@/lib/ai/question";
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
  signal?: AbortSignal,
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
  signal?: AbortSignal,
  /** The reader's previous turn. Null on a first message, which has none. */
  earlier: string | null = null,
): ReadableStream<UIMessageChunk> {
  return createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      let { sources, refusal } = await retrieveLocally(question);
      let asked = question;

      // A follow-up carries nothing to match: joining the previous turn takes
      // retrieval from 3 of 10 to 10, for one embedding (ADR 048).
      if (
        refusal === "no_relevant_passages" &&
        earlier !== null &&
        question.length > 0
      ) {
        const joined = `${earlier} ${question}`;
        const second = await retrieveLocally(joined);

        if (second.sources.length > 0) {
          ({ sources, refusal } = second);
          // The model gets it too. Retrieval matched on the joined text, and
          // "how often?" alone is the input a 0.5B grounds worst.
          asked = joined;

          // Metadata, as the route sends it: a data part written here arrives
          // before the `start` that opens the message, and builds a second one.
          writer.write({
            type: "message-metadata",
            messageMetadata: { searchedFor: joined },
          });
        }
      }

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

      for await (const delta of generate(asked, sources, signal)) {
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
    abortSignal,
  }: {
    messages: ChatUIMessage[];
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk>> {
    // `?? ""`: the route answers null with a 400, which means nothing here —
    // there is no request to reject, and retrieval refuses an empty question.
    return Promise.resolve(
      localAnswerStream(
        questionFrom(messages) ?? "",
        this.generate,
        abortSignal,
        // The turn before this one, which is what a follow-up leans on.
        questionFrom(messages.slice(0, -1)),
      ),
    );
  }

  /** Nothing to reconnect to: the stream never left this tab, so a reload has
   * no server-side turn to resume. */
  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}
