/**
 * External destinations, in one place. `/contact` is the route the policy names
 * now, but the repository is still what that page sends people to: the domain
 * sends mail and cannot receive it, so there is no address to publish yet.
 */
export const REPOSITORY_URL = "https://github.com/Patrascu-Lucian/CiteSeek";

/**
 * GET routes that write. A prefetch is a request nobody clicked, so linking to one
 * performs it — `/demo` gave every landing-page visitor a session. A list because
 * this is the third instance and a missing prop fails silently. `robots.ts`
 * reads the same list: a crawler is the one client that ignores the prop.
 */
export const SIDE_EFFECT_ROUTES = ["/demo", "/w"];

/** `undefined` keeps Next's default; `true` would force a full prefetch. */
export function prefetchFor(href: string): false | undefined {
  return SIDE_EFFECT_ROUTES.includes(href) ? false : undefined;
}
