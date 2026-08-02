/**
 * What seeding the demo fixture should do, given what the workspace already
 * holds.
 *
 * Split out of `seed.mts` so the decision can be tested without a database and
 * without running a script whose whole purpose is to write to one. The script
 * keeps the I/O; this keeps the rule.
 *
 * The rule it replaced was "if the workspace has any document at all, do
 * nothing". That is idempotent in the narrow sense — a second run changes
 * nothing — while quietly guaranteeing that **no already-seeded database would
 * ever pick up a change to the fixture**. Switching the handbook to a PDF would
 * have been a no-op everywhere it mattered, production included, and the seed
 * would have reported success. Idempotence toward whatever landed first is not
 * the property wanted; convergence toward the intended state is.
 */
export type FixtureSeedPlan = {
  /** Whether the fixture has to be ingested. */
  create: boolean;
  /** Ids of documents superseded by it, to delete first. */
  remove: string[];
  /** One line for the log, so a run says what it decided rather than only that it ran. */
  reason: string;
};

export function planFixtureSeed({
  existing,
  filename,
  supersededFilenames,
}: {
  existing: readonly { id: string; filename: string }[];
  filename: string;
  /** Filenames earlier versions of this fixture used. */
  supersededFilenames: readonly string[];
}): FixtureSeedPlan {
  if (existing.some((document) => document.filename === filename)) {
    return { create: false, remove: [], reason: `already holds ${filename}` };
  }

  const superseded = existing.filter((document) =>
    supersededFilenames.includes(document.filename),
  );

  if (superseded.length > 0) {
    return {
      create: true,
      remove: superseded.map((document) => document.id),
      reason: `replacing ${superseded
        .map((document) => document.filename)
        .join(", ")} with ${filename}`,
    };
  }

  // Anything else in the workspace is left alone: this owns one document, not
  // the workspace. A demo someone added a second file to should keep it.
  return { create: true, remove: [], reason: `seeding ${filename}` };
}
