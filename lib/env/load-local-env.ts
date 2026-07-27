/**
 * Loads `.env.local` for code that runs outside Next.js -- migrations, the seed
 * script, and the integration test config. Next loads env files itself, so
 * nothing in `app/` should ever need this.
 *
 * Uses Node's built-in `process.loadEnvFile` (Node 20.12+) rather than dotenv or
 * `@next/env`. Both of those are CommonJS and their default-export interop breaks
 * under Vite's transform, which is how the integration suite first failed to see
 * DATABASE_URL. A built-in has no interop surface to get wrong.
 *
 * Missing file is not an error: in CI and on Vercel the variables are already in
 * the real environment, and there is no `.env.local` to read.
 */
export function loadLocalEnv(path = ".env.local"): void {
  try {
    process.loadEnvFile(path);
  } catch {
    // No local env file - variables are expected to come from the environment.
  }
}
