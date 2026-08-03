/**
 * Split out of `seed.mts` so the decision is testable without a database. The
 * script keeps the I/O; this keeps the rule.
 *
 * It replaced "if the workspace has any document, do nothing" — idempotent in the
 * narrow sense, and a guarantee that **no already-seeded database could pick up a
 * fixture change**. Idempotence toward whatever landed first is not the property
 * wanted; convergence is.
 */
export type FixtureSeedPlan = {
  create: boolean;
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
