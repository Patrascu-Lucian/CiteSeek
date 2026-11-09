import { describe, expect, it } from "vitest";

import {
  MAX_QUESTION_CHARS,
  MAX_REQUEST_MESSAGES,
  MAX_TOTAL_CHARS,
  parseMessages,
} from "./request-bounds";

const question = (text: string, id = "q") => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

describe("parseMessages", () => {
  it.each([null, "messages", 42])("refuses a body of %s", (body) => {
    expect(parseMessages(body)).toBeNull();
  });

  it("refuses a body without a messages array", () => {
    expect(parseMessages({})).toBeNull();
    expect(parseMessages({ messages: "hi" })).toBeNull();
  });

  it("refuses a turn that is not an object, or has no parts array", () => {
    expect(parseMessages({ messages: [null] })).toBeNull();
    expect(
      parseMessages({ messages: [{ id: "q", role: "user", parts: "hi" }] }),
    ).toBeNull();
  });

  it("refuses an empty conversation", () => {
    expect(parseMessages({ messages: [] })).toBeNull();
  });

  it("accepts the most turns allowed, and refuses one more", () => {
    const turns = (n: number) =>
      Array.from({ length: n }, () => question("hi"));

    expect(
      parseMessages({ messages: turns(MAX_REQUEST_MESSAGES) }),
    ).toHaveLength(MAX_REQUEST_MESSAGES);
    expect(
      parseMessages({ messages: turns(MAX_REQUEST_MESSAGES + 1) }),
    ).toBeNull();
  });

  it("counts every turn's text toward the total, up to the limit exactly", () => {
    const answer = (length: number) => ({
      id: "a",
      role: "assistant",
      parts: [{ type: "text", text: "x".repeat(length) }],
    });

    expect(
      parseMessages({
        messages: [answer(MAX_TOTAL_CHARS - 2), question("hi")],
      }),
    ).not.toBeNull();
    expect(
      parseMessages({
        messages: [answer(MAX_TOTAL_CHARS - 1), question("hi")],
      }),
    ).toBeNull();
  });

  it("accepts a question at the composer's limit, and refuses one past it", () => {
    expect(
      parseMessages({ messages: [question("y".repeat(MAX_QUESTION_CHARS))] }),
    ).not.toBeNull();
    expect(
      parseMessages({
        messages: [question("y".repeat(MAX_QUESTION_CHARS + 1))],
      }),
    ).toBeNull();
  });

  it("measures a question's parts joined with nothing between them", () => {
    const half = "y".repeat(MAX_QUESTION_CHARS / 2);

    expect(
      parseMessages({
        messages: [
          {
            id: "q",
            role: "user",
            parts: [
              { type: "text", text: half },
              { type: "text", text: half },
            ],
          },
        ],
      }),
    ).not.toBeNull();
  });
});
