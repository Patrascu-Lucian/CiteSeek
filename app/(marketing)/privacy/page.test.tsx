import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/site-footer";
import { REPOSITORY_URL } from "@/lib/links";

import PrivacyPage from "./page";
import TermsPage from "../terms/page";

/**
 * These pages make claims a reader is entitled to rely on, and the claims are
 * about this codebase specifically. The tests below pin the ones that would be
 * *lies* if the implementation changed underneath them — not the prose.
 *
 * The provider warning is the sharpest of those. It exists because this
 * deployment runs on a free tier whose standard terms allow submitted content to
 * be used for service improvement. If that ever changes, this test failing is
 * the reminder that the sentence beside the upload control has to change with
 * it.
 */
describe("the privacy page", () => {
  it("says the original file is not kept", () => {
    // ADR 009: extracted text is stored, uploads are discarded. It is the part
    // of this system most worth stating, and the part most easily broken by a
    // future change that adds object storage.
    render(<PrivacyPage />);

    expect(screen.getByText(/never the original files/i)).toBeInTheDocument();
  });

  it("warns about the free tier rather than implying protections", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/do not upload anything confidential/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/free-tier terms/i)).toBeInTheDocument();
  });

  it("names every processor that receives data", () => {
    // A subprocessor list that omits one is worse than none.
    render(<PrivacyPage />);

    // `getAllByText`: some are named twice on purpose — the hosting section
    // says where things run, the processor list says who receives what.
    for (const name of [/Google \(Gemini API\)/, /Vercel/, /Neon/, /GitHub/]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("states the region and the retention window", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/Frankfurt/)).toBeInTheDocument();
    expect(screen.getByText(/kept for 30 days/i)).toBeInTheDocument();
  });

  it("says guests are never written to the database", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/nothing about a guest is written to the database/i),
    ).toBeInTheDocument();
  });

  it("carries the landmark the skip link points at", () => {
    // Every route has to, or "Skip to main content" lands nowhere.
    const { container } = render(<PrivacyPage />);

    expect(container.querySelector("main#main")).not.toBeNull();
  });
});

describe("the terms page", () => {
  it("says answers are checkable rather than correct", () => {
    // The honest claim, and the one the whole citation design supports. Saying
    // more than this would be the failure the project exists to avoid.
    render(<TermsPage />);

    expect(screen.getByText(/checkable/i)).toBeInTheDocument();
  });

  it("repeats the upload warning rather than only linking to it", () => {
    render(<TermsPage />);

    expect(
      screen.getByText(/do not upload confidential material/i),
    ).toBeInTheDocument();
  });

  it("carries the landmark the skip link points at", () => {
    const { container } = render(<TermsPage />);

    expect(container.querySelector("main#main")).not.toBeNull();
  });
});

describe("the contact route the policy promises", () => {
  it("links somewhere real for an erasure request", () => {
    // This sentence shipped once while no repository link existed anywhere in
    // the app — a policy promising a route to nothing.
    render(<PrivacyPage />);

    expect(
      screen.getByRole("link", { name: /the repository/i }),
    ).toHaveAttribute("href", REPOSITORY_URL);
  });

  it("is reachable from the footer on every page", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: /contact/i })).toHaveAttribute(
      "href",
      REPOSITORY_URL,
    );
  });
});
