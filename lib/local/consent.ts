/**
 * Whether this browser has already agreed to fetch the chat model.
 *
 * Module state was not enough: every route into `/local` is a plain `<a>`
 * because the page needs its own CSP (ADR 028), so arriving there is always a
 * full document load and anything held in memory is already gone. Consent has
 * to outlive the page or the gate asks again on every visit.
 *
 * `localStorage`, not a cookie: nothing on the server reads this, and sending it
 * with every request would put a local-mode fact on the wire.
 */
const KEY = "citeseek:local-model-consented";

/** Both sides are wrapped: Safari's private mode throws on `setItem` rather than
 * refusing quietly, and a browser that will not remember consent should still
 * offer the download rather than break the page. */
export function hasConsentedToModelDownload(): boolean {
  try {
    return localStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
}

export function rememberModelConsent(): void {
  try {
    localStorage.setItem(KEY, "yes");
  } catch {
    // Then the gate asks again next visit, which is the safe way to be wrong.
  }
}

/** Cleared with the documents: "delete everything" that leaves a record of what
 * you agreed to is not everything. */
export function forgetModelConsent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored if the write failed either.
  }
}
