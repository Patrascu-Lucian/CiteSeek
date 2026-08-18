import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadToWorkspace } from "@/lib/documents/upload";

import { UploadDropzone } from "./upload-dropzone";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/** A File whose bytes match its extension, so validation accepts it. */
function pdfFile(name = "report.pdf", size = 64): File {
  const bytes = new Uint8Array(size).fill(0x20);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  return new File([bytes], name, { type: "application/pdf" });
}

const onUploaded = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  onUploaded.mockClear();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ document: { id: "d1" } }), { status: 201 }),
  );
});

describe("UploadDropzone — affordances", () => {
  it("is a button, so it works without a mouse", async () => {
    // A div with drag handlers is invisible to keyboard and screen-reader
    // users, and "upload a document" cannot be a mouse-only capability.
    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );

    const dropzone = screen.getByRole("button", { name: /drop files here/i });
    await userEvent.tab();

    expect(dropzone).toHaveFocus();
  });

  it("labels the file input for assistive technology", () => {
    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );

    expect(
      screen.getByLabelText(/choose documents to upload/i),
    ).toBeInTheDocument();
  });

  it("states the accepted formats and size limit up front", () => {
    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );

    expect(screen.getByText(/PDF, Word/i)).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });
});

describe("UploadDropzone — client-side rejection", () => {
  it("rejects a disallowed extension without uploading it", async () => {
    // `applyAccept: false` simulates a user choosing "All files" in the OS
    // picker, or dropping the file. The `accept` attribute filters the picker
    // by default — which is why userEvent honors it — but it is a convenience,
    // not a control, and both of those paths get past it.
    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );

    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, new File(["x"], "photo.png"), {
      applyAccept: false,
    });

    expect(
      await screen.findByText(/\.png files are not supported/i),
    ).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects a file whose bytes do not match its extension", async () => {
    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );

    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, new File(["not a pdf"], "fake.pdf"));

    expect(await screen.findByText(/not a valid PDF/i)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("lets a rejected file be dismissed", async () => {
    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );

    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, new File(["x"], "photo.png"), {
      applyAccept: false,
    });
    await screen.findByText(/not supported/i);

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    await waitFor(() =>
      expect(screen.queryByText(/not supported/i)).not.toBeInTheDocument(),
    );
  });
});

describe("UploadDropzone — accepted files", () => {
  it("shows the file as queued until the list adopts it, then clears the row", async () => {
    // The handoff that fixes the "stuck at Queued" bug: the local row must
    // survive until the real list has the document, and must not survive after.
    // Leaving it would show every uploaded file twice — once permanently
    // "Queued" beside its own live entry.
    let releaseList: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    const slowOnUploaded = vi.fn().mockReturnValue(pending);

    render(
      <UploadDropzone
        send={uploadToWorkspace("ws")}
        onUploaded={slowOnUploaded}
      />,
    );

    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, pdfFile());

    expect(await screen.findByText(/queued/i)).toBeInTheDocument();

    releaseList();

    await waitFor(() =>
      expect(screen.queryByText(/queued/i)).not.toBeInTheDocument(),
    );
  });

  it("waits for the list before clearing, so the file is never nowhere", async () => {
    const slowOnUploaded = vi.fn().mockReturnValue(new Promise<void>(() => {}));

    render(
      <UploadDropzone
        send={uploadToWorkspace("ws")}
        onUploaded={slowOnUploaded}
      />,
    );

    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, pdfFile());

    await waitFor(() => expect(slowOnUploaded).toHaveBeenCalledOnce());
    // Still visible: the parent has not confirmed the document is listed.
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
  });

  it("posts to the workspace-scoped route", async () => {
    render(
      <UploadDropzone
        send={uploadToWorkspace("ws-42")}
        onUploaded={onUploaded}
      />,
    );

    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, pdfFile());

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/w/ws-42/documents",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("surfaces a server rejection rather than claiming success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "This file is 9.0 MB." }), {
        status: 400,
      }),
    );

    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );
    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, pdfFile());

    expect(
      await screen.findByText(/this file is 9\.0 MB/i),
    ).toBeInTheDocument();
  });

  it("survives a network failure with an actionable message", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    render(
      <UploadDropzone send={uploadToWorkspace("ws")} onUploaded={onUploaded} />,
    );
    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, pdfFile());

    expect(
      await screen.findByText(/check your connection/i),
    ).toBeInTheDocument();
  });

  it("announces upload progress politely", async () => {
    const slowOnUploaded = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    const { container } = render(
      <UploadDropzone
        send={uploadToWorkspace("ws")}
        onUploaded={slowOnUploaded}
      />,
    );

    const input = screen.getByLabelText(/choose documents to upload/i);
    await userEvent.upload(input, pdfFile());

    await waitFor(() =>
      expect(container.querySelector('[aria-live="polite"]')).not.toBeNull(),
    );
  });
});
