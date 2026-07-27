import { describe, expect, it, vi } from "vitest";

import { atMostEvery } from "./sweeps";

function fakeClock(start = 1_000) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

describe("atMostEvery", () => {
  it("runs on the first call, so a cold instance sweeps once", async () => {
    const clock = fakeClock();
    const work = vi.fn(() => Promise.resolve());
    const gate = atMostEvery(60_000, clock.now);

    await expect(gate(work)).resolves.toBe(true);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("skips the work for the rest of the interval", async () => {
    const clock = fakeClock();
    const work = vi.fn(() => Promise.resolve());
    const gate = atMostEvery(60_000, clock.now);
    await gate(work);

    clock.advance(59_999);

    await expect(gate(work)).resolves.toBe(false);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("runs again once the interval has passed", async () => {
    const clock = fakeClock();
    const work = vi.fn(() => Promise.resolve());
    const gate = atMostEvery(60_000, clock.now);
    await gate(work);

    clock.advance(60_000);

    await expect(gate(work)).resolves.toBe(true);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("counts from the last run, not the last call", async () => {
    // Otherwise a caller asking every two seconds would push the deadline back
    // each time and the work would never run again.
    const clock = fakeClock();
    const work = vi.fn(() => Promise.resolve());
    const gate = atMostEvery(60_000, clock.now);
    await gate(work);

    for (let elapsed = 2_000; elapsed < 60_000; elapsed += 2_000) {
      clock.advance(2_000);
      await gate(work);
    }
    expect(work).toHaveBeenCalledTimes(1);

    clock.advance(2_000);

    await expect(gate(work)).resolves.toBe(true);
  });

  it("does not spend the interval on work that threw", async () => {
    // The gate advancing on failure would skip the sweep until the next window,
    // and this endpoint is only polled while a document is processing — so the
    // next window can be much later than the interval.
    const clock = fakeClock();
    const gate = atMostEvery(60_000, clock.now);
    const failing = vi.fn(() => Promise.reject(new Error("connection lost")));

    await expect(gate(failing)).rejects.toThrow("connection lost");

    const retry = vi.fn(() => Promise.resolve());
    await expect(gate(retry)).resolves.toBe(true);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("thins a two-second poll to one run a minute", async () => {
    const clock = fakeClock();
    const work = vi.fn(() => Promise.resolve());
    const gate = atMostEvery(60_000, clock.now);

    // Five minutes of the documents list polling during ingestion.
    for (let tick = 0; tick < 150; tick++) {
      await gate(work);
      clock.advance(2_000);
    }

    expect(work).toHaveBeenCalledTimes(5);
  });

  it("keeps separate gates independent", async () => {
    const clock = fakeClock();
    const work = vi.fn(() => Promise.resolve());
    const minute = atMostEvery(60_000, clock.now);
    const hour = atMostEvery(3_600_000, clock.now);
    await minute(work);
    await hour(work);

    clock.advance(60_000);

    await expect(minute(work)).resolves.toBe(true);
    await expect(hour(work)).resolves.toBe(false);
  });
});
