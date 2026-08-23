import { describe, expect, it } from "vitest";

import { SOURCES_PART_ID } from "@/lib/ai/types";
import type { MessageCitation } from "@/lib/db/schema";

import type { ChatMessage } from "./queries";
import { toUIMessages } from "./to-ui-messages";

/**
 * Turning stored rows back into what the client renders.
 *
 * This is the seam a reload passes through, and until Milestone 4 it was only
 * ever exercised by hand: a reader had to sign in, ask something, and refresh.
 * Conversation history made it load-bearing — every conversation in the list
 * opens through here — so it needs assertions rather than attention.
 */

function citation(overrides: Partial<MessageCitation> = {}): MessageCitation {
  return {
    chunkId: "00000000-0000-4000-8000-000000000001",
    documentId: "00000000-0000-4000-8000-000000000002",
    filename: "handbook.pdf",
    pageNumber: 3,
    charStart: 0,
    charEnd: 38,
    quote: "Expenses are reimbursed within 30 days.",
    ...overrides,
  };
}

function stored(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    position: 0,
    role: "assistant",
    content: "Paid within 30 days [1].",
    citations: [citation()],
    refusalReason: null,
    rewrittenQuestion: null,
    createdAt: new Date("2026-07-30T10:00:00Z"),
    ...overrides,
  };
}

describe("toUIMessages", () => {
  it("keeps a question as plain text", () => {
    const [message] = toUIMessages([
      stored({ role: "user", content: "When is it paid?", citations: [] }),
    ]);

    expect(message).toEqual({
      id: "m1",
      role: "user",
      parts: [{ type: "text", text: "When is it paid?" }],
    });
  });

  it("rebuilds the sources part a streamed answer would have had", () => {
    // A reloaded message must be indistinguishable from a streamed one, or the
    // chips stop resolving after a refresh — and the failure is silent, because
    // the text still renders.
    const [message] = toUIMessages([stored()]);

    expect(message!.parts[0]).toMatchObject({
      type: "data-sources",
      id: SOURCES_PART_ID,
    });
    expect(message!.parts[1]).toEqual({
      type: "text",
      text: "Paid within 30 days [1].",
    });
  });

  it("numbers markers from the array position, starting at one", () => {
    const [message] = toUIMessages([
      stored({
        citations: [
          citation({ chunkId: "a" }),
          citation({ chunkId: "b" }),
          citation({ chunkId: "c" }),
        ],
      }),
    ]);

    const part = message!.parts[0] as {
      data: { marker: number; chunkId: string }[];
    };
    expect(part.data.map((s) => s.marker)).toEqual([1, 2, 3]);
    expect(part.data.map((s) => s.chunkId)).toEqual(["a", "b", "c"]);
  });

  /**
   * The invariant the storage format exists for. `appendMessages` writes the
   * **whole numbered source list**, not only the passages the model cited,
   * because the marker here is the array index — storing a subset would
   * renumber it on reload and silently repoint every `[n]` in the text at a
   * different passage.
   */
  it("resolves [n] to the same passage it did while streaming", () => {
    const sources = [
      citation({ chunkId: "first", quote: "The first passage." }),
      citation({ chunkId: "second", quote: "The second passage." }),
    ];

    const [message] = toUIMessages([
      stored({ content: "This came from [2].", citations: sources }),
    ]);

    const part = message!.parts[0] as {
      data: { marker: number; quote: string }[];
    };
    const cited = part.data.find((s) => s.marker === 2);
    expect(cited!.quote).toBe("The second passage.");
  });

  it("gives a refusal no sources part, so nothing can render a chip", () => {
    // The milestone-2 guarantee, surviving a reload: an answer with no citations
    // must not acquire an empty sources part that a marker could resolve against.
    const [message] = toUIMessages([
      stored({ content: "I couldn't find anything relevant.", citations: [] }),
    ]);

    expect(message!.parts).toEqual([
      { type: "text", text: "I couldn't find anything relevant." },
    ]);
  });

  it("preserves order across a whole conversation", () => {
    const messages = toUIMessages([
      stored({
        id: "m1",
        position: 0,
        role: "user",
        content: "Q1",
        citations: [],
      }),
      stored({ id: "m2", position: 1, content: "A1" }),
      stored({
        id: "m3",
        position: 2,
        role: "user",
        content: "Q2",
        citations: [],
      }),
      stored({ id: "m4", position: 3, content: "A2" }),
    ]);

    expect(messages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
  });
});

describe("toUIMessages — a refused turn", () => {
  it("rebuilds the refusal part from the stored reason", () => {
    // Without this, a refused turn came back on the next visit as a bare
    // sentence saying nothing was found — still true, and stripped of
    // everything that told the reader what to do about it.
    const [message] = toUIMessages([
      stored({
        content: "I couldn't find anything relevant.",
        citations: [],
        refusalReason: "no_relevant_passages",
      }),
    ]);

    expect(message?.parts).toEqual([
      {
        type: "data-refusal",
        id: "refusal",
        data: { reason: "no_relevant_passages" },
      },
      { type: "text", text: "I couldn't find anything relevant." },
    ]);
  });

  it("carries the reason through rather than flattening the two apart", () => {
    const [message] = toUIMessages([
      stored({ citations: [], refusalReason: "no_documents" }),
    ]);

    expect(message?.parts[0]).toMatchObject({
      data: { reason: "no_documents" },
    });
  });

  it("gives a grounded answer no refusal part", () => {
    const [message] = toUIMessages([stored()]);

    expect(message?.parts.some((p) => p.type === "data-refusal")).toBe(false);
  });

  it("prefers the refusal when a row somehow carries both", () => {
    // The route cannot write both, and if a row ever did, the refusal is the
    // claim that nothing was grounded — so it wins over a source list that
    // should not exist. Rendering chips on a refusal is the one outcome this
    // design must never produce.
    const [message] = toUIMessages([
      stored({ refusalReason: "no_relevant_passages" }),
    ]);

    expect(message?.parts.some((p) => p.type === "data-sources")).toBe(false);
  });
});

describe("a turn the rewrite is what retrieved", () => {
  /* Metadata, not a part: on reload it has to land on the same message as the
     text, which is what a data part written before `start` does not do. */
  it("restores the question that was searched", () => {
    const [message] = toUIMessages([
      stored({ rewrittenQuestion: "How much is the deposit?" }),
    ]);

    expect(message?.metadata).toEqual({
      searchedFor: "How much is the deposit?",
    });
  });

  it("leaves metadata off a turn that was not rewritten", () => {
    expect(toUIMessages([stored()])[0]?.metadata).toBeUndefined();
  });
});
