import { describe, expect, it } from "vitest";

import {
  InterruptableStoppingCriteria,
  StoppingCriteriaList,
} from "@huggingface/transformers";

/**
 * The library, not our code: `generate.test.ts` mocks transformers.js, so every
 * assertion there is about what we *send*.
 *
 * Necessary, not sufficient. The method that actually receives our bare criteria
 * is `_get_stopping_criteria`, which is private and unreachable without a model,
 * so a version demanding a list would leave the second test green and break Stop
 * in the browser. Closing that needs a real model — `docs/backlog.md`.
 */

/** `generate` passes token ids; only the batch shape matters to the criteria. */
const oneSequence = [[1n, 2n, 3n]];

describe("the contract generateLocally depends on", () => {
  it("reports no stop until interrupted, and a stop after", () => {
    // The Stop button and the loop detector both work by calling `interrupt()`
    // on an object handed to `generate`. Our own tests can only prove we call
    // it; this proves calling it means stop.
    const criteria = new InterruptableStoppingCriteria();

    expect(criteria(oneSequence)).toEqual([false]);

    criteria.interrupt();

    expect(criteria(oneSequence)).toEqual([true]);
  });

  it("accepts a bare criteria where a list is expected", () => {
    // `generateLocally` passes `stopping_criteria: stopping` — one object, not a
    // list — and `_get_stopping_criteria` puts it through `extend`, which only
    // works because `extend` takes either.
    const criteria = new InterruptableStoppingCriteria();
    const list = new StoppingCriteriaList();

    list.extend(criteria);
    criteria.interrupt();

    expect(list(oneSequence)).toEqual([true]);
  });
});
