import { describe, expect, it } from "vitest";

import { questionFrom } from "./question";
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
