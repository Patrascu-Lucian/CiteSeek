/**
 * The theme toggle's height, which is emergent rather than a token: `size-7`
 * inside `p-0.5` and a border. Stated rather than derived, because `h-auto`
 * against `items-stretch` collapses to text height in the mobile sheet.
 *
 * Its own module because it crosses the server/client boundary — importing it
 * from `site-header.tsx` would pull `next/headers` into the client bundle.
 */
export const HEADER_CONTROL_HEIGHT = "h-[34px]";
