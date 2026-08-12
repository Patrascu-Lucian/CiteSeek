import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Refusal } from "./refusal";

function renderRefusal(props: Partial<Parameters<typeof Refusal>[0]> = {}) {
  return render(
    <Refusal
      reason="no_relevant_passages"
      documents={["handbook.pdf", "expenses.docx"]}
      canUpload
      signedIn
      uploadHref="/w/w1"
      {...props}
    />,
  );
}

describe("Refusal — when documents exist but nothing matched", () => {
  it("names what it can answer from", () => {
    // The whole point. "Nothing found" is correct and useless; what makes it
    // useful is saying what a question *could* have been answered from.
    renderRefusal();

    expect(screen.getByText("handbook.pdf")).toBeInTheDocument();
    expect(screen.getByText("expenses.docx")).toBeInTheDocument();
  });

  it("says its knowledge does not extend to the app itself", () => {
    // The question that motivated this — "how do I upload a file?" — is refused
    // because the answer is not in anyone's documents, and a reader has no way
    // to know that unless it is said.
    renderRefusal();

    expect(screen.getByText(/no knowledge outside them/i)).toBeInTheDocument();
    expect(screen.getByText(/about this app itself/i)).toBeInTheDocument();
  });

  it("suggests rephrasing against the wording the document uses", () => {
    renderRefusal();

    expect(screen.getByText(/naming the section/i)).toBeInTheDocument();
  });
});

describe("Refusal — when nothing is searchable", () => {
  it("does not list documents it cannot answer from", () => {
    renderRefusal({ reason: "no_documents", documents: [] });

    expect(screen.getByText(/nothing to search yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("treats an empty document list as nothing to search, whatever the reason", () => {
    // The reason is a fact about retrieval at the time of the refusal; the list
    // is what is searchable now. If they disagree, the reader is looking at the
    // list, so that is what the copy has to match.
    renderRefusal({ reason: "no_relevant_passages", documents: [] });

    expect(screen.getByText(/nothing to search yet/i)).toBeInTheDocument();
  });
});

describe("Refusal — what it offers depends on who is reading", () => {
  it("points a writer at the upload area they already have", () => {
    renderRefusal({ canUpload: true });

    expect(
      screen.getByRole("link", { name: /this workspace/i }),
    ).toHaveAttribute("href", "/w/w1");
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });

  it("offers a guest a way to get a workspace of their own", () => {
    renderRefusal({ canUpload: false, signedIn: false });

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("never tells a read-only visitor to upload something", () => {
    // An instruction they cannot follow, which is the same failure the
    // read-only card in the workspace exists to avoid.
    renderRefusal({ canUpload: false, signedIn: true });

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /your workspace/i }),
    ).toHaveAttribute("href", "/w");
  });
});
