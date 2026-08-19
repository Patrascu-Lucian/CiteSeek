/** Shares `AUTH_URL` rather than adding a second canonical-URL variable: two
 * would drift, and nothing fails when a card points somewhere Auth.js does
 * not recognize. */

export type SiteUrlEnv = {
  AUTH_URL?: string | undefined;
  VERCEL_URL?: string | undefined;
  [key: string]: string | undefined;
};

export function siteUrl(env: SiteUrlEnv = process.env): URL {
  const canonical = env.AUTH_URL?.trim();
  if (canonical) return new URL(canonical);

  const preview = env.VERCEL_URL?.trim();
  if (preview) return new URL(`https://${preview}`);

  return new URL("http://localhost:3000");
}
