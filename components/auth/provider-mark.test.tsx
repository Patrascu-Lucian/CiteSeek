import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AUTH_PROVIDERS } from "@/lib/auth/providers";

import { ProviderMark } from "./provider-mark";

describe("the provider marks", () => {
  it.each(AUTH_PROVIDERS.map(({ id }) => id))("has one for %s", (id) => {
    // The list and the marks are separate on purpose, so nothing but this stops
    // a third provider shipping as a button with a gap where its logo goes.
    const { container } = render(<ProviderMark provider={id} />);

    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is hidden from the accessibility tree, because the label says it", () => {
    const { container } = render(<ProviderMark provider="github" />);

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders nothing for an id it does not know", () => {
    // A button with no logo still signs you in; a thrown error signs nobody in.
    const { container } = render(<ProviderMark provider="nonesuch" />);

    expect(container).toBeEmptyDOMElement();
  });
});
