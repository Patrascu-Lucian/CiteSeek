/**
 * Two figures, because only one of them is time to first token: the stream opens
 * with the citation payload before the model is called, so a reader sees sources
 * resolve well before prose begins. Quoting only the smaller number would be
 * flattering and wrong (README, Numbers).
 *
 * Spends provider quota and counts against this project's own rate limiter, so
 * the default target is localhost and production has to be asked for by name.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { base, guestSession } from "./measure/session.mts";
import {
  sampleLine,
  ttftFigures,
  ttftReport,
  type TtftSample,
} from "./measure/ttft-report.mts";

const samples = Number(process.env.MEASURE_SAMPLES ?? "4");
// The guest limit (`lib/usage/config.ts`) counts provider calls, two per answered
// question, so an unpaced run is refused after four or five. 16000 stays under it.
const pauseMs = Number(process.env.MEASURE_PAUSE_MS ?? "0");
// Opt-in, or a localhost run would replace the figures the landing page quotes.
const publish = process.env.MEASURE_PUBLISH === "1";

if (!Number.isInteger(samples) || samples < 1) {
  throw new Error(
    `MEASURE_SAMPLES must be a positive integer, not "${String(process.env.MEASURE_SAMPLES)}".`,
  );
}

if (!Number.isInteger(pauseMs) || pauseMs < 0) {
  throw new Error(
    `MEASURE_PAUSE_MS must be a whole number of milliseconds, not "${String(process.env.MEASURE_PAUSE_MS)}".`,
  );
}

/** A question the seeded demo document answers, so the floor is cleared and the
 * model actually runs. */
const QUESTION = "What is the expenses policy?";

const { cookie, location } = await guestSession();
// `/demo` redirects to `/w/<id>`, which is the only place the id is published.
const workspaceId = new URL(location).pathname.split("/")[2]!;

/** Milliseconds from request start to the first byte of the stream, and to the
 * first `text-delta` in it. */
async function once(): Promise<{ firstByte: number; firstToken: number }> {
  const started = performance.now();

  const response = await fetch(`${base}/api/w/${workspaceId}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: QUESTION }],
        },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`The chat route answered ${String(response.status)}.`);
  }

  let firstByte = 0;
  let buffer = "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    firstByte ||= performance.now() - started;
    buffer += decoder.decode(value, { stream: true });

    // A refusal streams in the same shape as an answer, deliberately, so the
    // client has one code path (ADR 011) — and that shape defeats a check on
    // `text-delta` alone. No answering model runs there, so timing one would put
    // a retrieval round trip into the published median as a generation.
    if (buffer.includes('"type":"data-refusal"')) {
      await reader.cancel();
      throw new Error(
        "The question was refused, so there is no first token to time.",
      );
    }

    if (buffer.includes('"type":"text-delta"')) {
      // The rest of the answer costs nothing measured here, and cancelling frees
      // the connection rather than waiting out a stream nobody reads.
      await reader.cancel();

      return { firstByte, firstToken: performance.now() - started };
    }
  }

  throw new Error("The stream closed before a token arrived.");
}

const outcomes: TtftSample[] = [];
const warmedUp = process.env.MEASURE_WARMUP !== "0";

// Discarded, not counted: the first request after a cold function measured
// 1,639 ms against a 400 ms steady state, and a four-sample median cannot
// absorb that. Set MEASURE_WARMUP=0 to keep it.
if (warmedUp) {
  const warm = await once().catch((error: unknown) => error as Error);
  console.log(
    `  warm-up (discarded): ${warm instanceof Error ? warm.message : `${warm.firstToken.toFixed(0)} ms`}`,
  );
}

for (let i = 0; i < samples; i += 1) {
  if (pauseMs > 0 && (warmedUp || i > 0)) await sleep(pauseMs);

  // Every sample is paid for. A rate-limit refusal on the fifth used to throw
  // away the four already bought, and the published figures were reassembled by
  // hand from the lines above.
  const outcome = await once().catch(
    (error: unknown) => (error as Error).message,
  );
  outcomes.push(outcome);
  console.log(`  ${String(i + 1)}: ${sampleLine(outcome)}`);
}

const figures = ttftFigures(outcomes);

if (!figures) throw new Error("No sample completed.");

console.log(
  `\n${base} over ${String(figures.completed)} of ${String(samples)} samples — first byte ${figures.firstByte}, first token ${figures.firstToken}`,
);

if (publish) {
  await writeFile(
    join(import.meta.dirname, "..", "eval", "ttft.md"),
    ttftReport({
      day: new Date().toISOString().slice(0, 10),
      base,
      question: QUESTION,
      warmedUp,
      pauseMs,
      samples: outcomes,
    }),
  );
  console.log("Wrote eval/ttft.md.");
}
