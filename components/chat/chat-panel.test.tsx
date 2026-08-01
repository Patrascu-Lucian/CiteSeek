import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";

import { ChatPanel } from "./chat-panel";

/**
 * `useChat` owns a network connection, so it is replaced here. Everything else —
 * the states, the wiring, the accessible names — is the component's own and runs
 * for real. The route's behavior is covered by its integration tests instead.
 */
const chat = vi.hoisted(() => ({
  messages: [] as ChatUIMessage[],
  status: "ready",
  error: undefined as Error | undefined,
  sendMessage: vi.fn(),
  regenerate: vi.fn(),
  stop: vi.fn(),
  clearError: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({ useChat: () => chat }));

const SOURCE: ChatSource = {
  marker: 1,
  chunkId: "chunk-1",
  documentId: "doc-1",
  filename: "handbook.pdf",
  pageNumber: 3,
  charStart: 0,
  charEnd: 10,
  quote: "Expenses are reimbursed within 30 days.",
};

const ANSWER: ChatUIMessage = {
  id: "m2",
  role: "assistant",
  parts: [
    { type: "data-sources", id: "sources", data: [SOURCE] },
    { type: "text", text: "Paid in 30 days [1]." },
  ],
};

beforeEach(() => {
  chat.messages = [];
  chat.status = "ready";
  chat.error = undefined;
  vi.clearAllMocks();
});

function renderPanel(hasReadyDocuments = true, signedIn = false) {
  render(
    <ChatPanel
      workspaceId="w1"
      hasReadyDocuments={hasReadyDocuments}
      signedIn={signedIn}
    />,
  );
}

/**
 * What the transport actually hands the client for a refusal.
 *
 * Both the pre-flight 429 and a mid-stream provider error arrive as an `Error`
 * whose *message is the JSON body* — the SDK throws `new Error(response.text())`
 * and turns a stream error part into `new Error(errorText)`. Building the
 * fixture that way rather than passing a bare code keeps this test honest about
 * the shape the component has to survive.
 */
function refusalError(code: "rate_limited" | "capacity_reached") {
  return new Error(JSON.stringify({ error: "…", code }));
}

describe("ChatPanel — states", () => {
  it("explains there is nothing to search before any document is ready", () => {
    // Every question here would retrieve nothing and get the same refusal,
    // which reads like a broken feature rather than an empty one.
    renderPanel(false);

    expect(screen.getByText(/nothing to search yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("invites a first question once a document is ready", () => {
    renderPanel();

    expect(
      screen.getByRole("textbox", { name: /ask a question/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/answers cite the passages/i)).toBeInTheDocument();
  });

  it("announces progress without reading the answer aloud on every token", () => {
    // A live region wrapped around streaming text re-reads the whole answer as
    // each token lands. This announces state instead.
    chat.status = "streaming";
    renderPanel();

    const status = screen.getByText(/writing an answer/i);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("offers a retry when the answer fails", async () => {
    chat.error = new Error("stream broke");
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/didn't come through/i);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    // Cleared first, so a second failure re-renders the alert rather than
    // leaving a stale one on screen.
    expect(chat.clearError).toHaveBeenCalledOnce();
    expect(chat.regenerate).toHaveBeenCalledOnce();
  });
});

describe("ChatPanel — refused for capacity", () => {
  it("offers a retry when the refusal is only a burst", async () => {
    chat.error = refusalError("rate_limited");
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/wait a moment/i);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(chat.regenerate).toHaveBeenCalledOnce();
  });

  /**
   * The distinction the whole state exists for. Retrying a daily cap cannot
   * work, so a button that invites it teaches the reader the product is broken
   * rather than busy.
   */
  it("offers no retry once the day's capacity is gone", () => {
    chat.error = refusalError("capacity_reached");
    renderPanel();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/today's capacity/i);
    expect(
      within(alert).queryByRole("button", { name: /try again|retry/i }),
    ).toBeNull();
  });

  it("points a guest at signing in, which genuinely has its own headroom", () => {
    chat.error = refusalError("capacity_reached");
    renderPanel(true, false);

    // Not a consolation link: the global cap reserves room below the guest
    // ceiling, so a signed-in reader really can keep working here.
    expect(
      within(screen.getByRole("alert")).getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/sign-in");
  });

  it("does not tell a signed-in user to sign in", () => {
    chat.error = refusalError("capacity_reached");
    renderPanel(true, true);

    const alert = screen.getByRole("alert");
    expect(within(alert).queryByRole("link")).toBeNull();
    expect(alert).toHaveTextContent(/resets within 24 hours/i);
  });

  it("falls back to the generic failure when the body is not a refusal", () => {
    // A dropped connection, an HTML error page, a proxy timeout: none of these
    // are JSON, and none may be reported as a limit the reader did not hit.
    chat.error = new Error("<html>502 Bad Gateway</html>");
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/didn't come through/i);
  });
});

describe("ChatPanel — asking", () => {
  it("sends the question and clears the composer", async () => {
    renderPanel();

    await userEvent.type(screen.getByRole("textbox"), "What is the policy?");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(chat.sendMessage).toHaveBeenCalledWith({
      text: "What is the policy?",
    });
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("stops a reply that is still streaming", async () => {
    chat.status = "streaming";
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /stop/i }));

    expect(chat.stop).toHaveBeenCalledOnce();
  });
});

describe("ChatPanel — citations", () => {
  /*
    `Answer` is behind a dynamic import, so the first chip in this file does not
    exist until Vitest has transformed the markdown stack — comfortably over
    Testing Library's 1s default on a loaded machine. Same allowance, and same
    reason, as the `message-list` specs.
  */
  const CHIP_TIMEOUT = { timeout: 5_000 };

  it("opens the source panel when a chip is activated", async () => {
    chat.messages = [ANSWER];
    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /^Citation 1/ }, CHIP_TIMEOUT),
    );

    // What the panel then renders is its own concern and its own tests. What
    // matters here is that the chip reaches it, naming the right document.
    const panel = await screen.findByRole("dialog");
    expect(
      within(panel).getByRole("heading", { name: "handbook.pdf" }),
    ).toBeInTheDocument();
  });

  it("marks the chip as pressed while its passage is open", async () => {
    chat.messages = [ANSWER];
    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /^Citation 1/ }, CHIP_TIMEOUT),
    );

    // Re-queried rather than reusing the reference: the markdown renderer
    // rebuilds its output on re-render, so the original node is detached.
    expect(
      await screen.findByRole("button", { name: /^Citation 1/ }, CHIP_TIMEOUT),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("closes the panel again", async () => {
    chat.messages = [ANSWER];
    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /^Citation 1/ }, CHIP_TIMEOUT),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /close/i,
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
