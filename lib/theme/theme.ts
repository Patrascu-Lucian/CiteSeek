/**
 * Three values: "system" is a real answer, not the absence of one — it means keep
 * following the OS, including when it flips at sunset.
 *
 * A cookie, not `localStorage` (ADR 018): it arrives with the request, so the
 * server renders the right class on the first byte. `localStorage` is invisible
 * to the server, which is why the usual implementation needs a pre-paint script.
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
 * `system` is **no class**, handing the decision to `prefers-color-scheme` —
 * reading the OS in JavaScript cannot work server-side and reintroduces the
 * first-paint problem. `light` is explicit because it has to *beat* the media
 * query on a machine set to dark.
 */
export function themeClass(theme: Theme): string {
  return theme === "system" ? "" : theme;
}
