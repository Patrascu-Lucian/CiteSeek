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

/** A question the seeded demo document answers, so the floor is cleared and the
 * model actually runs. */
const QUESTION = "What is the expenses policy?";

async function demoSession() {
  const response = await fetch(`${base}/demo`, { redirect: "manual" }).catch(
    () => {
      throw new Error(`Nothing is answering on ${base}.`);
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

    if (buffer.includes('"type":"text-delta"')) {
      // The rest of the answer costs nothing measured here, and cancelling frees
      // the connection rather than waiting out a stream nobody reads.
      await reader.cancel();

      return { firstByte, firstToken: performance.now() - started };
    }
  }

  throw new Error("The stream closed before a token arrived — a refusal?");
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

const runs: { firstByte: number; firstToken: number }[] = [];

for (let i = 0; i < samples; i += 1) {
  const run = await once();
  runs.push(run);
  console.log(
    `  ${String(i + 1)}: first byte ${run.firstByte.toFixed(0)} ms, first token ${run.firstToken.toFixed(0)} ms`,
  );
}

console.log(
  `\n${base} over ${String(samples)} samples — first byte ${median(runs.map((r) => r.firstByte)).toFixed(0)} ms, first token ${(median(runs.map((r) => r.firstToken)) / 1000).toFixed(2)} s`,
);
