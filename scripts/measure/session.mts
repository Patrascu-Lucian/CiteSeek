/**
 * Where to point, and a guest session to point with. The three `measure-*`
 * scripts had a copy each, so a fix to one — the `AUTH_SECRET` hint, the
 * `new URL` check — never reached the others.
 */

/** Localhost by default, so production has to be asked for by name. */
export const base = process.env.MEASURE_BASE_URL ?? "http://localhost:3000";

// Catches a typo before the run discovers it. Not a security check: a valid URL
// can still hold `$(…)`, which is why the Lighthouse call quotes its arguments.
new URL(base);

/** The midpoint of the two middles on an even count. `measure-ttft`'s default
 * sample size is even, and an index pick returns the upper one — which is the
 * sample a cold start lands in. Lighthouse scores are integers, so an even
 * `MEASURE_RUNS` there can print a `.5`. */
export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
};

/**
 * `/demo` mints the guest cookie and redirects. Without it `proxy.ts` sends any
 * `/w/*` to sign-in, and these scripts would measure that page under the name of
 * the one asked for. `location` is absolute, so a caller can take a whole URL, a
 * pathname or an id from it without re-deriving the base.
 */
export async function guestSession(): Promise<{
  cookie: string;
  location: string;
}> {
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

  if (!location) throw new Error("/demo did not redirect.");
  // `/demo` sends no cookie when the secret or the database is missing.
  if (!cookie) throw new Error("/demo set no cookie — is AUTH_SECRET set?");

  return { cookie, location: new URL(location, base).href };
}
