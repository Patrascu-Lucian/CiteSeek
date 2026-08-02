/**
 * Which palette to paint, and how that decision is stored.
 *
 * Three values, because "system" is a real answer rather than the absence of
 * one: a reader who has never chosen wants their OS setting followed, and a
 * reader who chose "system" deliberately wants the same thing to keep happening
 * when their OS flips at sunset. Collapsing them would mean the second reader
 * silently gets whatever the OS said the moment they last clicked.
 *
 * Stored in a cookie rather than `localStorage` — see ADR 018. The short version
 * is that a cookie arrives with the request, so the server renders the right
 * class on the first byte and there is no flash to suppress and no blocking
 * script to write. `localStorage` is invisible to the server, which is why the
 * usual implementation of this feature needs a script that runs before paint.
 */
export const THEME_VALUES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEME_VALUES)[number];

export const THEME_COOKIE_NAME = "citeseek_theme";

/** A year. A preference nobody has changed is still that reader's preference. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" &&
    (THEME_VALUES as readonly string[]).includes(value)
  );
}

/**
 * The class the root element carries for a given preference.
 *
 * `system` is deliberately **no class at all**, which hands the decision to the
 * `prefers-color-scheme` block in `globals.css`. The alternative — reading the
 * OS setting in JavaScript and writing a class — cannot work on the server,
 * where there is no OS setting to read, and would reintroduce exactly the
 * first-paint problem the cookie removes.
 *
 * `light` is an explicit class rather than nothing, because it has to *beat* the
 * media query for a reader whose OS is dark but who asked for light here.
 */
export function themeClass(theme: Theme): string {
  return theme === "system" ? "" : theme;
}
