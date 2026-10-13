/** Its own module because `playwright.config.ts` loads env files and asserts the
 * database is disposable at import — a spec importing the config re-runs all
 * three in every worker, and the assertion throws with a message written for
 * config time. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3000);

/** A second server, held down, so the 503 path is a gate rather than a
 * measurement somebody once took by hand. `MAINTENANCE` is read per request but
 * the environment is fixed per process, so one server cannot serve both. */
export const MAINTENANCE_PORT = E2E_PORT + 1;

/** A third, whose fake model waits between chunks, for the one spec that needs
 * an answer still streaming when it acts. Fixed per process for the same reason. */
export const SLOW_STREAM_PORT = E2E_PORT + 2;
