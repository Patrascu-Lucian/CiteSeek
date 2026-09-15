import type { LanguageModelV4Prompt } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { acceptRewrite, rewriteQuestion } from "./rewrite";
import type { ChatUIMessage } from "./types";

type Finish = "stop" | "length";

const reply: {
  text: string;
  throws: boolean;
  finish: Finish;
  /** What the model was sent, to check the history the rewrite builds. */
  prompt: LanguageModelV4Prompt;
} = vi.hoisted(() => ({ text: "", throws: false, finish: "stop", prompt: [] }));

vi.mock("./provider", () => ({
  getChatModel: () =>
    new MockLanguageModelV4({
      doGenerate: (options) => {
        reply.prompt = options.prompt;
        if (reply.throws) return Promise.reject(new Error("provider down"));

        return Promise.resolve({
          content: [{ type: "text" as const, text: reply.text }],
          finishReason: { unified: reply.finish, raw: undefined },
          usage: {
            inputTokens: {
              total: 12,
              noCache: 12,
              cacheRead: 0,
              cacheWrite: 0,
            },
            outputTokens: { total: 4, text: 4, reasoning: 0 },
          },
          warnings: [],
        });
      },
    }),
}));

const user = (text: string): ChatUIMessage => ({
  id: "u",
  role: "user",
  parts: [{ type: "text", text }],
});

const assistant = (text: string): ChatUIMessage => ({
  id: "a",
  role: "assistant",
  parts: [{ type: "text", text }],
});

describe("acceptRewrite", () => {
  it("takes a rewrite that gained a subject", () => {
    expect(acceptRewrite("How much is the tenancy deposit?", "how much?")).toBe(
      "How much is the tenancy deposit?",
    );
  });

  it("strips the quotes a model wraps its answer in", () => {
    // Only the wrapping pair: a quote inside the question is part of it.
    expect(
      acceptRewrite('"Is the landlord\'s deposit protected?"', "is it?"),
    ).toBe("Is the landlord's deposit protected?");
  });

  it("keeps only the first line, where the model went on to explain itself", () => {
    expect(
      acceptRewrite("How much is the deposit?\nI inferred this from…", "how?"),
    ).toBe("How much is the deposit?");
  });

  it("reads past a blank line the model opened with", () => {
    expect(acceptRewrite("\nHow much is the deposit?", "how much?")).toBe(
      "How much is the deposit?",
    );
  });

  // Nothing was gained, and the caller has already searched for exactly this.
  it("refuses a rewrite that repeats the question", () => {
    expect(acceptRewrite("  How Much? ", "how much?")).toBeNull();
  });

  it("refuses an empty rewrite", () => {
    expect(acceptRewrite("   ", "how much?")).toBeNull();
  });

  it("refuses a rewrite longer than a question", () => {
    expect(acceptRewrite("word ".repeat(60), "how much?")).toBeNull();
  });
});

describe("rewriteQuestion", () => {
  beforeEach(() => {
    reply.throws = false;
    reply.finish = "stop";
  });

  it("refuses a rewrite the model ran out of room to finish", async () => {
    // A truncated question is still under `MAX_CHARS` and still reads as a
    // question, so nothing downstream rejects it — and it would be shown to the
    // reader as what we searched for.
    reply.finish = "length";
    reply.text = "How much is the tenancy deposit for a property with";

    await expect(
      rewriteQuestion(
        [
          user("Is the deposit protected?"),
          assistant("Yes."),
          user("how much?"),
        ],
        "how much?",
      ),
    ).resolves.toBeNull();
  });

  // No model call at all: a first message has no earlier turn to recover a
  // subject from, so any rewrite would be inventing one.
  it("does not reach the model for the first message of a conversation", async () => {
    reply.text = "How much is the tenancy deposit?";

    await expect(
      rewriteQuestion([user("how much?")], "how much?"),
    ).resolves.toBeNull();
  });

  it("returns the rewrite with the tokens it cost", async () => {
    reply.text = "How much is the tenancy deposit?";

    await expect(
      rewriteQuestion(
        [
          user("Is the deposit protected?"),
          assistant("Yes."),
          user("how much?"),
        ],
        "how much?",
      ),
    ).resolves.toEqual({
      question: "How much is the tenancy deposit?",
      inputTokens: 12,
      outputTokens: 4,
    });
  });

  /* The turn has already failed to retrieve. A provider error here has to leave
     a refusal the reader can act on, not a broken stream — which is exactly what
     a fake model with no `doGenerate` produced in dev. */
  it("returns null rather than failing the turn when the provider throws", async () => {
    reply.throws = true;

    await expect(
      rewriteQuestion(
        [
          user("Is the deposit protected?"),
          assistant("Yes."),
          user("how much?"),
        ],
        "how much?",
      ),
    ).resolves.toBeNull();
  });

  it("returns null when the model gave nothing usable back", async () => {
    reply.text = "how much?";

    await expect(
      rewriteQuestion(
        [
          user("Is the deposit protected?"),
          assistant("Yes."),
          user("how much?"),
        ],
        "how much?",
      ),
    ).resolves.toBeNull();
  });

  it("shows the model the last six turns, as role-prefixed text", async () => {
    // Text parts only, and only the latest turns: a long transcript would
    // otherwise price a refusal like an answer.
    reply.text = "How much is the tenancy deposit?";

    await rewriteQuestion(
      [
        user("An early question, dropped"),
        assistant("An early answer, dropped"),
        user("Is the deposit protected?"),
        {
          ...assistant("Yes."),
          parts: [{ type: "step-start" }, { type: "text", text: "Yes." }],
        },
        user("And the rent?"),
        assistant("Monthly."),
        user("Paid how?"),
        user("how much?"),
      ],
      "how much?",
    );

    const sent = reply.prompt
      .flatMap((message) => (message.role === "user" ? message.content : []))
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");

    expect(sent).toBe(
      [
        "user: Is the deposit protected?",
        "assistant: Yes.",
        "user: And the rent?",
        "assistant: Monthly.",
        "user: Paid how?",
        "user: how much?",
      ].join("\n"),
    );
  });
});
