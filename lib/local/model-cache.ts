/**
 * Where transformers.js writes model weights under Node. Its default is
 * `.cache/` inside its own package, which put 3.1 GB in `node_modules` and made
 * `pnpm build` fail intermittently — `docs/backlog.md`.
 */
export function nodeModelCacheDir(
  env: Record<string, string | undefined>,
): string | null {
  const override = env.CITESEEK_MODEL_CACHE?.trim();
  if (override) return override;

  const home = env.HOME ?? env.USERPROFILE;

  // Null rather than a guess: leaving the library's own default alone is better
  // than writing gigabytes somewhere nobody expects.
  return home ? `${home}/.cache/citeseek-transformers` : null;
}

/**
 * Called on both model-loading paths, which normally run in a browser. The
 * library's own `cacheDir` is the runtime check: it is null wherever there is no
 * filesystem, so a browser never reaches `process`.
 */
export function useNodeModelCache(env: { cacheDir: string | null }): void {
  if (!env.cacheDir) return;

  const dir = nodeModelCacheDir(process.env);
  if (dir) env.cacheDir = dir;
}
