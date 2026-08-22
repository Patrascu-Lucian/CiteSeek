import { describe, expect, it } from "vitest";

import { questionFrom, questionIdFrom } from "./question";
import type { ChatUIMessage } from "./types";

const user = (...texts: string[]): ChatUIMessage => ({
  id: "u",
  role: "user",
  parts: texts.map((text) => ({ type: "text", text })),
});

const assistant = (text: string): ChatUIMessage => ({
  id: "a",
  role: "assistant",
  parts: [{ type: "text", text }],
});

describe("questionFrom", () => {
  it("reads the newest question", () => {
    expect(questionFrom([user("first"), assistant("ok"), user("second")])).toBe(
      "second",
    );
  });

  it("skips past an assistant turn to find the question", () => {
    // Local mode took `messages.at(-1)` whatever its role, so a transcript
    // ending in an answer had the model's own words embedded as the question.
    expect(
      questionFrom([user("when is it paid?"), assistant("in 30 days")]),
    ).toBe("when is it paid?");
  });

  it("joins several text parts with a space", () => {
    // With `""` the two halves fused — "30 days.Expenses" — which embeds to a
    // different vector than the sentence a reader wrote.
    expect(questionFrom([user("30 days.", "Expenses?")])).toBe(
      "30 days. Expenses?",
    );
  });

  it("ignores parts that are not text", () => {
    const message = {
      id: "u",
      role: "user",
      parts: [{ type: "step-start" }, { type: "text", text: "the question" }],
    } as unknown as ChatUIMessage;

    expect(questionFrom([message])).toBe("the question");
  });

  it("returns null for a question that is only whitespace", () => {
    expect(questionFrom([user("   ")])).toBeNull();
  });

  it("returns null when nobody has asked anything", () => {
    expect(questionFrom([])).toBeNull();
    expect(questionFrom([assistant("unprompted")])).toBeNull();
  });
});

describe("questionIdFrom", () => {
  /* The id has to survive to the route, or the turn cannot be named back to the
     database — which is what made editing a just-asked question fail. */
  it("takes the id of the question being asked", () => {
    const asked: ChatUIMessage = {
      id: "3f1c9b6e-9a2a-4a4a-8a1a-9b2c3d4e5f60",
      role: "user",
      parts: [{ type: "text", text: "How much leave?" }],
    };

    expect(questionIdFrom([assistant("earlier"), asked])).toBe(asked.id);
  });

  it("looks past a trailing assistant turn, as its sibling does", () => {
    const asked: ChatUIMessage = {
      id: "abc",
      role: "user",
      parts: [{ type: "text", text: "How much leave?" }],
    };

    expect(questionIdFrom([asked, assistant("28 days")])).toBe("abc");
  });

  it("answers null when nobody has asked anything", () => {
    expect(questionIdFrom([])).toBeNull();
    expect(questionIdFrom([assistant("unprompted")])).toBeNull();
  });

  it("answers null for a question carrying no id", () => {
    // `appendMessages` then falls through to `defaultRandom()`.
    const anonymous = {
      role: "user",
      parts: [{ type: "text", text: "How much leave?" }],
    } as unknown as ChatUIMessage;

    expect(questionIdFrom([anonymous])).toBeNull();
  });
});
