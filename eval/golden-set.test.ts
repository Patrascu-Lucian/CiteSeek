import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ADJACENT_SET,
  CONVERSATION_SEQUENCES,
  CONVERSATION_SET,
  FOLLOW_UP_SET,
  GOLDEN_SET,
  ANSWER_SET,
  UNCOVERED_SET,
} from "./golden-set";

/** A broken quote fails as a retrieval regression rather than as a broken quote.
 * The harness needs a database and real embeddings; this needs neither, so the
 * rot is caught in CI rather than on whichever afternoon someone runs it. */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const text = (file: string) => readFileSync(join(FIXTURES, file), "utf8");

describe.each([
  { name: "golden", expectations: GOLDEN_SET.flatMap((one) => one.expect) },
  {
    name: "follow-up",
    expectations: FOLLOW_UP_SET.flatMap((one) => one.expect),
  },
  {
    name: "local-answer",
    expectations: ANSWER_SET.flatMap((one) => one.expect),
  },
])("the $name set", ({ expectations }) => {
  it("quotes every passage verbatim", () => {
    for (const { file, quote } of expectations) {
      // Line breaks survive normalization, so a quote spanning one never
      // resolves — which is how the first run of the harness failed.
      expect(quote, `"${quote}" is not in ${file}`).not.toMatch(/\n/);
      expect(text(file), `"${quote}" is not in ${file}`).toContain(quote);
    }
  });

  it("quotes each passage unambiguously", () => {
    // `indexOf` takes the first hit, so a quote appearing twice would silently
    // measure retrieval against whichever copy came first in the file.
    for (const { file, quote } of expectations) {
      const source = text(file);
      const first = source.indexOf(quote);

      expect(
        source.indexOf(quote, first + 1),
        `"${quote}" appears more than once in ${file}`,
      ).toBe(-1);
    }
  });
});

describe("the sets together", () => {
  it("has no quote that another quote contains", () => {
    // Reword a fixture and the longer quote fails loudly, while the shorter one
    // keeps matching a passage that no longer means what it was chosen for.
    const quotes = [...GOLDEN_SET, ...FOLLOW_UP_SET, ...ANSWER_SET].flatMap(
      (one) => one.expect.map((e) => e.quote),
    );

    for (const quote of quotes) {
      expect(
        quotes.filter((other) => other !== quote && other.includes(quote)),
        `"${quote}" is contained by another quote`,
      ).toEqual([]);
    }
  });
});

describe("the golden set", () => {
  it("keeps enough unanswerable questions to measure the floor", () => {
    // A set of only answerable questions cannot see the floor fail open, which
    // is the failure that puts an ungrounded answer in front of a reader.
    const unanswerable = GOLDEN_SET.filter((one) => one.expect.length === 0);

    expect(unanswerable.length).toBeGreaterThanOrEqual(10);
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(40);
  });
});

// Function words too: "Is there a gym nearby?" passed on "there".
const STOPWORDS = new Set([
  "what",
  "does",
  "which",
  "much",
  "often",
  "should",
  "there",
  "when",
  "many",
  "from",
  "have",
  "with",
  "that",
  "this",
  "your",
]);

/** Four letters or more, so "the" and "for" never count as a shared word. */
const contentWords = (question: string) =>
  (question.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(
    (word) => !STOPWORDS.has(word),
  );

const sharedWords = (question: string, source: string) =>
  contentWords(question).filter((word) =>
    new RegExp(`\\b${word}\\b`).test(source),
  );

describe("the uncovered set", () => {
  it("names something in the document each question is about", () => {
    // The mechanical half of the invariant. A question sharing no word with its
    // document is a far-off one, which the golden set already has; whether the
    // document leaves it unanswered is what `eval:refusals` reads.
    for (const one of UNCOVERED_SET) {
      expect(
        sharedWords(one.question, text(one.about).toLowerCase()),
        one.question,
      ).not.toEqual([]);
    }
  });

  it("spreads across all three fixtures", () => {
    expect(new Set(UNCOVERED_SET.map((one) => one.about)).size).toBe(3);
  });

  it("asks nothing the golden set already asks", () => {
    // A question in both would be counted twice wherever the sets are combined.
    const golden = new Set(GOLDEN_SET.map((one) => one.question));

    for (const one of UNCOVERED_SET) {
      expect(golden.has(one.question), one.question).toBe(false);
    }
  });
});

describe("the adjacent set", () => {
  // The words a reader sees, not the stylesheet or the authoring comment.
  const handbook = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "lib",
      "db",
      "fixtures",
      "northwind-remote-work-handbook.html",
    ),
    "utf8",
  )
    .replace(/<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();

  it("names something the handbook covers in every question", () => {
    for (const one of ADJACENT_SET) {
      expect(sharedWords(one.question, handbook), one.question).not.toEqual([]);
    }
  });

  it("carries the live site's laptop warranty, marked as seen", () => {
    expect(ADJACENT_SET).toContainEqual({
      question: "What is the warranty on the company laptop?",
      seen: true,
    });
  });

  it("asks nothing another refusal set already asks", () => {
    const asked = new Set(
      [...GOLDEN_SET, ...UNCOVERED_SET].map((one) => one.question),
    );

    for (const one of ADJACENT_SET) {
      expect(asked.has(one.question), one.question).toBe(false);
    }
  });
});

describe("the local-answer set", () => {
  it("accepts at least one spelling the document actually uses", () => {
    // The alternates are there for how a model might write the value, so they
    // need not appear. If none does, the case scores 0 forever and reads as a
    // model failure rather than a case that asks for wording nobody wrote.
    for (const one of ANSWER_SET) {
      const sources = one.expect.map((e) => text(e.file));

      expect(
        one.answerContains.filter((spelling) =>
          sources.some((source) => source.includes(spelling)),
        ),
        one.question,
      ).not.toEqual([]);
    }
  });

  it("asks only questions the corpus answers", () => {
    // Grounding is the measurement, so an unanswerable case scores a floor the
    // report has no column for.
    for (const one of ANSWER_SET) {
      expect(one.expect.length, one.question).toBeGreaterThan(0);
      expect(one.answerContains.length, one.question).toBeGreaterThan(0);
    }
  });

  it("covers all three fixtures", () => {
    // The manual was a pure distractor for the first eight questions: the score
    // moved with two documents and the third only competed for retrieval.
    const files = new Set(
      ANSWER_SET.flatMap((one) => one.expect).map((e) => e.file),
    );

    expect(files.size).toBe(3);
    expect(ANSWER_SET.length).toBeGreaterThanOrEqual(20);
  });
});

describe("the follow-up set", () => {
  /* Both halves have to be answerable, or the comparison measures nothing: the
     standalone column is the ceiling, and a case the corpus cannot answer either
     way would report a gap of zero and look like success. */
  it("expects a passage for every case", () => {
    for (const one of FOLLOW_UP_SET) {
      expect(one.expect.length, one.followUp).toBeGreaterThan(0);
    }
  });

  it("carries the turns a rewriting step would read", () => {
    for (const one of FOLLOW_UP_SET) {
      expect(one.context.length, one.followUp).toBeGreaterThan(0);
    }
  });

  it("keeps the follow-up shorter than the standalone it stands for", () => {
    // The point of the case is that the typed form carries less. One as long as
    // its standalone is not a follow-up, and would flatter the "as asked" score.
    for (const one of FOLLOW_UP_SET) {
      expect(one.followUp.length, one.followUp).toBeLessThan(
        one.standalone.length,
      );
    }
  });
});

describe("the conversation set", () => {
  const byQuestion = new Map(ANSWER_SET.map((one) => [one.question, one]));
  const answer = (question: string) => {
    const found = byQuestion.get(question);
    if (!found) throw new Error(`Not an ANSWER_SET question: "${question}"`);
    return found.expect[0]!;
  };
  const conditions = ["afterTopicChange", "afterSameTopic"] as const;

  it("asks every answer-set question second, exactly once", () => {
    expect(CONVERSATION_SET.map((one) => one.ask).sort()).toEqual(
      ANSWER_SET.map((one) => one.question).sort(),
    );
  });

  it("opens every conversation with an answer-set question", () => {
    for (const one of CONVERSATION_SET) {
      for (const condition of conditions) {
        expect(byQuestion.has(one[condition]), one[condition]).toBe(true);
      }
    }
  });

  it("changes the topic to another fixture", () => {
    for (const one of CONVERSATION_SET) {
      expect(answer(one.afterTopicChange).file, one.ask).not.toBe(
        answer(one.ask).file,
      );
    }
  });

  it("keeps the topic in the same fixture, never on the same answer", () => {
    // "If I am leaving" and "to move out" share one quote, so either would
    // carry the other's answer into its history.
    for (const one of CONVERSATION_SET) {
      expect(answer(one.afterSameTopic).file, one.ask).toBe(
        answer(one.ask).file,
      );
      expect(answer(one.afterSameTopic).quote, one.ask).not.toBe(
        answer(one.ask).quote,
      );
    }
  });

  it("opens no more than two conversations with one question", () => {
    for (const condition of conditions) {
      const uses = new Map<string, number>();
      for (const one of CONVERSATION_SET) {
        uses.set(one[condition], (uses.get(one[condition]) ?? 0) + 1);
      }

      expect(Math.max(...uses.values()), condition).toBeLessThanOrEqual(2);
    }
  });

  it("asks the credit cap after the press, as the 1.11.0 exit check did", () => {
    expect(
      CONVERSATION_SET.find(
        (one) => one.ask === "What is the cap on credits in a month?",
      )?.afterTopicChange,
    ).toBe("How much force does the press develop?");
  });

  it("asks the exit check's sequence from the answer set", () => {
    // Its later turns are read as a refusal or not, which needs the spellings
    // only `ANSWER_SET` carries.
    const exitCheck = CONVERSATION_SEQUENCES.find(
      (one) => one.corpus === "fixtures",
    );

    expect(exitCheck?.turns.length).toBeGreaterThan(1);
    for (const turn of exitCheck?.turns ?? []) {
      expect(byQuestion.has(turn), turn).toBe(true);
    }
  });
});
