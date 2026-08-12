import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NO_RELEVANT_PASSAGES_REPLY } from "@/lib/ai/prompt";
import type { ChatUIMessage } from "@/lib/ai/types";

import { fakeLocalEmbedding } from "./fake-embedder";
import { putLocalChunks, putLocalDocument } from "./store";
import { LocalChatTransport, localAnswerStream } from "./transport";

const PASSAGE =
  "Reimbursement is paid within thirty days of approval. Submit the " +
  "claim through the finance portal and a manager approves it before " +
  "payment runs on the last working day of the month.";

async function seed() {
  await putLocalDocument({
    id: "doc-1",
    filename: "handbook.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    status: "ready",
    error: null,
    text: "stored document text",
    pageCount: 1,
    chunkCount: 1,
    embeddingDimensions: 384,
    createdAt: 1,
    updatedAt: 1,
  });
  await putLocalChunks("doc-1", [
    {
      id: "c1",
      documentId: "doc-1",
      index: 0,
      text: PASSAGE,
      page: 1,
      startOffset: 0,
      endOffset: PASSAGE.length,
      embedding: fakeLocalEmbedding(PASSAGE),
    },
  ]);
}

// eslint-disable-next-line @typescript-eslint/require-await
async function* answers(): AsyncIterable<string> {
  yield "Within ";
  yield "thirty days [1].";
}

/** A reader rather than `for await`: the DOM lib does not type a
 * `ReadableStream` as async-iterable, though Node runs it happily. */
async function collect(stream: ReadableStream<{ type: string }>) {
  const reader = stream.getReader();
  const chunks: { type: string }[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return chunks;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  (globalThis as { __citeseekLocalEmbedder?: string }).__citeseekLocalEmbedder =
    "fake";
});

describe("localAnswerStream", () => {
  it("writes the sources before the first token of prose", async () => {
    /*
      The whole guarantee, in one assertion. `data-sources` is a fact about
      retrieval; if it were written after generation it would be a summary of
      what the model claimed, and a marker could point at nothing. ADR 011.
    */
    await seed();

    const chunks = await collect(
      localAnswerStream("reimbursement paid within thirty", answers),
    );
    const types = chunks.map((chunk) => chunk.type);

    expect(types.indexOf("data-sources")).toBeLessThan(
      types.indexOf("text-delta"),
    );
  });

  it("never runs the model when retrieval refuses", async () => {
    // Not "unlikely to cite" — there is no generation step in which to invent
    // a citation.
    await seed();
    const generate = vi.fn(answers);

    const chunks = await collect(
      localAnswerStream("sourdough bread baking", generate),
    );

    expect(generate).not.toHaveBeenCalled();
    expect(chunks.map((chunk) => chunk.type)).not.toContain("data-sources");
  });

  it("carries the refusal reason, not just the copy", async () => {
    await seed();

    const chunks = await collect(
      localAnswerStream("sourdough bread baking", answers),
    );
    const refusal = chunks.find((chunk) => chunk.type === "data-refusal");

    expect(refusal).toMatchObject({ data: { reason: "no_relevant_passages" } });
  });

  it("says the same thing the route says", async () => {
    // Shared, not retyped: two copies of a refusal drift, and this text is the
    // product's most-read sentence when it cannot answer.
    const chunks = await collect(localAnswerStream("anything at all", answers));
    const text = chunks
      .filter(
        (chunk): chunk is { type: string; delta: string } =>
          chunk.type === "text-delta",
      )
      .map((chunk) => chunk.delta)
      .join("");

    expect(text).toBe(NO_RELEVANT_PASSAGES_REPLY);
  });

  it("distinguishes an empty corpus from an unmatched question", async () => {
    const chunks = await collect(localAnswerStream("reimbursement", answers));

    const refusal = chunks.find((chunk) => chunk.type === "data-refusal");

    expect(refusal).toMatchObject({ data: { reason: "no_documents" } });
  });

  it("streams the answer in the deltas it was given", async () => {
    await seed();

    const chunks = await collect(
      localAnswerStream("reimbursement paid within thirty", answers),
    );
    const deltas = chunks.filter((chunk) => chunk.type === "text-delta");

    expect(deltas).toHaveLength(2);
  });
});

describe("LocalChatTransport", () => {
  it("asks about the newest message, not the whole transcript", async () => {
    await seed();
    const generate = vi.fn(answers);
    const transport = new LocalChatTransport(generate);

    const messages: ChatUIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text", text: "hi" }],
      },
      {
        id: "3",
        role: "user",
        parts: [{ type: "text", text: "reimbursement paid within thirty" }],
      },
    ];

    await collect(await transport.sendMessages({ messages }));

    expect(generate).toHaveBeenCalledWith(
      "reimbursement paid within thirty",
      expect.arrayContaining([expect.objectContaining({ chunkId: "c1" })]),
    );
  });

  it("has nothing to reconnect to, because nothing left the tab", async () => {
    const transport = new LocalChatTransport(answers);

    expect(await transport.reconnectToStream()).toBeNull();
  });
});

describe("a turn with nothing in it", () => {
  it("asks an empty question rather than throwing", async () => {
    // `useChat` can call with no messages on a fresh mount; retrieval then
    // refuses, which is the correct outcome for an empty question.
    const transport = new LocalChatTransport(answers);

    const chunks = await collect(
      await transport.sendMessages({ messages: [] }),
    );

    expect(chunks.map((chunk) => chunk.type)).toContain("data-refusal");
  });
});
