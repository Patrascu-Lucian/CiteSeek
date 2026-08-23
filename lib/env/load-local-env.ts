/**
 * `.env.local` for code outside Next — migrations, the seed, the integration
 * config; nothing in `app/` needs it. Node's built-in `loadEnvFile` rather than
 * dotenv or `@next/env`: both are CommonJS and their interop breaks under Vite's
 * transform, which is how the integration suite first failed to see
 * DATABASE_URL. A missing file is fine — CI and Vercel already have the values.
 */
export function loadLocalEnv(path = ".env.local"): void {
  try {
    process.loadEnvFile(path);
  } catch {
    // No local env file - variables are expected to come from the environment.
  }
}
