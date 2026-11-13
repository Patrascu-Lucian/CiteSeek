import { median } from "./session.mts";

/** Its two timings, or the reason it has none. */
export type TtftSample = { firstByte: number; firstToken: number } | string;

export const sampleLine = (sample: TtftSample) =>
  typeof sample === "string"
    ? sample
    : `first byte ${sample.firstByte.toFixed(0)} ms, first token ${sample.firstToken.toFixed(0)} ms`;

/** Formatted as the landing page quotes them. */
export function ttftFigures(samples: readonly TtftSample[]) {
  const runs = samples.filter((sample) => typeof sample !== "string");

  if (runs.length === 0) return null;

  const firstByte = median(runs.map((run) => run.firstByte));
  const firstToken = median(runs.map((run) => run.firstToken));

  return {
    completed: runs.length,
    firstByte: `${firstByte.toFixed(0)} ms`,
    firstToken: `${(firstToken / 1000).toFixed(2)} s`,
  };
}

/** One sentence per line, so the diff between two runs shows only what moved. */
export function ttftReport(input: {
  day: string;
  base: string;
  question: string;
  warmedUp: boolean;
  pauseMs: number;
  samples: readonly TtftSample[];
}): string {
  const figures = ttftFigures(input.samples);

  if (!figures) throw new Error("No sample completed.");

  const warmUp = input.warmedUp
    ? "A warm-up request was discarded first."
    : "No warm-up request was discarded.";
  const pause =
    input.pauseMs > 0
      ? `, with a ${String(input.pauseMs / 1000)} s pause between requests`
      : "";
  const lines = input.samples.map(
    (sample, index) => `- ${String(index + 1)}: ${sampleLine(sample)}`,
  );

  return `# Time to first token

Run ${input.day} by \`pnpm perf:ttft\` against ${input.base}.
Asked as a guest in the demo: "${input.question}"
${warmUp}
${String(figures.completed)} of ${String(input.samples.length)} samples completed${pause}.

**${figures.firstByte}** to the first byte of the stream, which is the citation payload.

**${figures.firstToken}** to the first token of the answer.

Both are medians of the completed samples. Each sample, from request start:

${lines.join("\n")}
`;
}
