import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatError } from "./chat-error";

describe("ChatError — a capacity refusal", () => {
  it.each([
    [false, "caller", "You have reached today's limit for the demo."],
    [false, "global", "The demo has reached today's capacity."],
    [true, "caller", "You have reached today's limit."],
    [true, "global", "Today's capacity has been reached."],
  ] as const)(
    "names the demo only when not signed in (signed in: %s, %s)",
    (signedIn, scope, title) => {
      render(
        <ChatError
          refusal={{ code: "capacity_reached", scope }}
          signedIn={signedIn}
          onRetry={() => undefined}
        />,
      );

      expect(screen.getByText(title)).toBeInTheDocument();
    },
  );
});
