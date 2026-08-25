/**
 * Two figures, because only one of them is time to first token: the stream opens
 * with the citation payload before the model is called, so a reader sees sources
 * resolve well before prose begins. Quoting only the smaller number would be
 * flattering and wrong (README, Numbers).
 *
 * Spends provider quota and counts against this project's own rate limiter, so
 * the default target is localhost and production has to be asked for by name.
 */
const base = process.env.MEASURE_BASE_URL ?? "http://localhost:3000";
const samples = Number(process.env.MEASURE_SAMPLES ?? "4");

if (!Number.isInteger(samples) || samples < 1) {
  throw new Error(
    `MEASURE_SAMPLES must be a positive integer, not "${String(process.env.MEASURE_SAMPLES)}".`,
  );
}

/** A question the seeded demo document answers, so the floor is cleared and the
 * model actually runs. */
const QUESTION = "What is the expenses policy?";

async function demoSession() {
  // `cause` because the message is a guess: DNS, TLS and a proxy refusal all
  // arrive here and none of them is "nothing is listening".
  const response = await fetch(`${base}/demo`, { redirect: "manual" }).catch(
    (cause: unknown) => {
      throw new Error(
        `Cannot reach ${base}. For localhost, run \`pnpm build && pnpm start\` first.`,
        { cause },
      );
    },
  );

  const cookie = response.headers
    .getSetCookie()
    .map((one) => one.split(";")[0])
    .join("; ");
  const location = response.headers.get("location");

  if (!cookie || !location) throw new Error("/demo gave no guest session.");

  return {
    cookie,
    workspaceId: new URL(location, base).pathname.split("/")[2]!,
  };
}

const { cookie, workspaceId } = await demoSession();

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

/** The midpoint of the two middles on an even count. The default sample size is
 * even, and an index pick returns the upper one — which is the sample a cold
 * start lands in. */
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
};

const runs: { firstByte: number; firstToken: number }[] = [];

// Discarded, not counted: the first request after a cold function measured
// 1,639 ms against a 400 ms steady state, and a four-sample median cannot
// absorb that. Set MEASURE_WARMUP=0 to keep it.
if (process.env.MEASURE_WARMUP !== "0") {
  const warm = await once().catch((error: unknown) => error as Error);
  console.log(
    `  warm-up (discarded): ${warm instanceof Error ? warm.message : `${warm.firstToken.toFixed(0)} ms`}`,
  );
}

for (let i = 0; i < samples; i += 1) {
  // Every sample is paid for. A rate-limit refusal on the fifth used to throw
  // away the four already bought, and the published figures were reassembled by
  // hand from the lines above.
  try {
    const run = await once();
    runs.push(run);
    console.log(
      `  ${String(i + 1)}: first byte ${run.firstByte.toFixed(0)} ms, first token ${run.firstToken.toFixed(0)} ms`,
    );
  } catch (error) {
    console.log(`  ${String(i + 1)}: ${(error as Error).message}`);
  }
}

if (runs.length === 0) throw new Error("No sample completed.");

console.log(
  `\n${base} over ${String(runs.length)} of ${String(samples)} samples — first byte ${median(runs.map((r) => r.firstByte)).toFixed(0)} ms, first token ${(median(runs.map((r) => r.firstToken)) / 1000).toFixed(2)} s`,
);
