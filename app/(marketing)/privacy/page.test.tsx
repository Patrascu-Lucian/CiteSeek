import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/site-footer";
import { REPOSITORY_URL } from "@/lib/links";

import PrivacyPage from "./page";
import TermsPage from "../terms/page";

/**
 * These pages make claims a reader is entitled to rely on. The tests pin the ones
 * that would be *lies* if the implementation changed underneath them, not the
 * prose — what the model provider may do with the text most of all.
 */
describe("the privacy page", () => {
  it("says the original file is not kept", () => {
    // ADR 009: extracted text is stored, uploads are discarded. It is the part
    // of this system most worth stating, and the part most easily broken by a
    // future change that adds object storage.
    render(<PrivacyPage />);

    expect(screen.getByText(/never the original files/i)).toBeInTheDocument();
  });

  it("describes the tier the deployment is actually on", () => {
    // Pinned because it is the one claim on this page that is bought rather than
    // built: it holds only while the Google project has billing attached, and a
    // page promising more than the deployment delivers is the failure to avoid.
    render(<PrivacyPage />);

    // Both places, not one: the summary at the top and the section that explains
    // it have to agree, or a reader gets the answer that scrolls past first.
    expect(screen.getAllByText(/paid tier/i)).toHaveLength(2);
    expect(
      screen.getByText(/not used to train or improve their models/i),
    ).toBeInTheDocument();
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

  it("says the uploader keeps ownership", () => {
    render(<TermsPage />);

    expect(
      screen.getByText(/gives this project no ownership/i),
    ).toBeInTheDocument();
  });

  it("limits the no-training claim to what this project controls", () => {
    /*
      The privacy page states that Google's free tier may use submitted content
      to improve its services. A flat "never used for training" here would
      contradict it, and the contradiction would favor whichever page a reader
      saw second. The scope is the whole claim.
    */
    render(<TermsPage />);

    expect(
      screen.getByText(/under this project(’|')s control/i),
    ).toBeInTheDocument();
  });

  it("does not claim the demo stores nothing, which is false when signed in", () => {
    // `route.ts` persists on `actorType === "user"` with no workspace check, so a
    // signed-in reader's demo conversations are saved. The page said otherwise
    // for four milestones because nothing pinned it.
    render(<TermsPage />);

    expect(
      screen.getByText(/ask as a guest and nothing is stored/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/saved to your own history, where only you can see it/i),
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
