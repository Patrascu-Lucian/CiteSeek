import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgetModelConsent,
  hasConsentedToModelDownload,
  rememberModelConsent,
} from "./consent";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("remembering that the download was agreed to", () => {
  it("has not been agreed to before anyone says so", () => {
    expect(hasConsentedToModelDownload()).toBe(false);
  });

  it("survives being read back, which a page load is", () => {
    // The whole point: every route into /local is a plain anchor for the CSP
    // (ADR 028), so arriving is always a fresh document and module state is
    // already gone.
    rememberModelConsent();

    expect(hasConsentedToModelDownload()).toBe(true);
  });

  it("is forgotten with the documents", () => {
    rememberModelConsent();

    forgetModelConsent();

    expect(hasConsentedToModelDownload()).toBe(false);
  });

  it("reports no consent when storage refuses to be read", () => {
    // Private browsing throws rather than returning null. Offering the download
    // again is the safe way to be wrong.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(hasConsentedToModelDownload()).toBe(false);
  });

  it("does not throw when storage refuses to be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => rememberModelConsent()).not.toThrow();
  });
});
