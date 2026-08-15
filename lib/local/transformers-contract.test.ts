import { describe, expect, it } from "vitest";

import {
  InterruptableStoppingCriteria,
  StoppingCriteriaList,
} from "@huggingface/transformers";

/**
 * The library, not our code. `generate.test.ts` mocks transformers.js, so every
 * assertion there is about what we *send*; these are about what it does with it.
 *
 * Both things pinned here were established by reading the bundle during a
 * debugging session, and reading is not a test — a version bump could change
 * either one and nothing would go red until someone opened a browser.
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
    // list. transformers.js calls `criteria.extend(...)` on it internally, which
    // only works because `extend` takes either.
    const criteria = new InterruptableStoppingCriteria();
    const list = new StoppingCriteriaList();

    list.extend(criteria);
    criteria.interrupt();

    expect(list(oneSequence)).toEqual([true]);
  });
});
