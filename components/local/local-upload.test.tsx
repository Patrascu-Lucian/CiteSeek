import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Ingest from "@/lib/local/ingest";

import { LocalUpload } from "./local-upload";

const ingest = vi.hoisted(() => ({
  file: vi.fn(),
  embed: vi.fn(),
}));

vi.mock("@/lib/local/ingest", async (importOriginal) => ({
  ...(await importOriginal<typeof Ingest>()),
  ingestLocalFile: ingest.file,
  embedLocalDocument: ingest.embed,
}));

function pdf(name = "report.pdf"): File {
  const bytes = new Uint8Array(64).fill(0x20);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  return new File([bytes], name, { type: "application/pdf" });
}

const document = { id: "d1", chunkCount: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  ingest.embed.mockResolvedValue({ ok: true });
});

describe("LocalUpload — a failed ingest", () => {
  it("accepts another file after one throws", async () => {
    // A throw escaped every reset of the busy flag, so the next upload answered
    // "one at a time" for the life of the tab. `NotReadableError` gets there.
    ingest.file
      .mockRejectedValueOnce(new Error("NotReadableError"))
      .mockResolvedValueOnce({ ok: true, document });

    render(<LocalUpload onIngested={() => undefined} />);
    const input = screen.getByLabelText(/choose documents to upload/i);

    await userEvent.upload(input, pdf("first.pdf"));
    await screen.findByRole("alert");

    await userEvent.upload(input, pdf("second.pdf"));

    await waitFor(() => expect(ingest.file).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByText(/one document at a time/i),
    ).not.toBeInTheDocument();
  });

  it("says the file could not be read rather than failing silently", async () => {
    ingest.file.mockRejectedValue(new Error("NotReadableError"));

    render(<LocalUpload onIngested={() => undefined} />);

    await userEvent.upload(
      screen.getByLabelText(/choose documents to upload/i),
      pdf(),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not read that file/i,
    );
  });
});
