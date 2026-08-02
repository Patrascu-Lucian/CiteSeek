import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, validateUpload } from "@/lib/documents/validation";

/**
 * Drag-and-drop, multi-file upload.
 *
 * Files are validated **client-side using the same function the server runs**,
 * so a rejected file never leaves the machine and the user sees why immediately
 * rather than after uploading 4 MB. The server repeats the check regardless —
 * this is a courtesy, not a control, and anything that skips the browser hits
 * the identical validation on the route.
 *
 * The drop target is also a real `<button>`. A div with drag handlers is
 * invisible to keyboard and screen-reader users, and "upload a document" cannot
 * be a mouse-only capability.
 */

type QueuedFile = {
  id: string;
  name: string;
  state: "uploading" | "queued" | "rejected";
  message?: string;
};

export function UploadDropzone({
  workspaceId,
  onUploaded,
}: {
  workspaceId: string;
  /**
   * Awaited before the local row is cleared, so the document is already in the
   * real list by the time this component stops showing it — no gap where an
   * uploaded file appears nowhere.
   */
  onUploaded: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<QueuedFile[]>([]);

  async function upload(file: File, id: string) {
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`/api/w/${workspaceId}/documents`, {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setFiles((current) =>
          current.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  state: "rejected",
                  message: payload?.error ?? "Upload failed.",
                }
              : entry,
          ),
        );
        return;
      }

      setFiles((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, state: "queued" } : entry,
        ),
      );

      // Wait for the list to pick the document up, then stop showing it here.
      // Clearing first would leave a moment where the file appears nowhere.
      await onUploaded();
      setFiles((current) => current.filter((entry) => entry.id !== id));
    } catch {
      setFiles((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                state: "rejected",
                message: "Upload failed. Check your connection and try again.",
              }
            : entry,
        ),
      );
    }
  }

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;

    for (const file of Array.from(selected)) {
      const id = crypto.randomUUID();

      // Only the first bytes are read, for the signature check — reading 4 MB
      // to reject a mislabelled file is wasted work. The real size comes from
      // `File.size`, which the browser already knows.
      const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const validation = validateUpload(file.name, head, file.size);

      if (!validation.ok) {
        setFiles((current) => [
          ...current,
          {
            id,
            name: file.name,
            state: "rejected",
            message: validation.message,
          },
        ]);
        continue;
      }

      setFiles((current) => [
        ...current,
        { id, name: file.name, state: "uploading" },
      ]);
      void upload(file, id);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={`border-border hover:border-foreground/30 focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none ${
          isDragging ? "border-foreground/50 bg-muted/40" : ""
        }`}
      >
        <Upload aria-hidden="true" className="text-muted-foreground size-6" />
        <span className="text-sm font-medium">
          Drop files here, or click to browse
        </span>
        <span className="text-muted-foreground text-xs">
          PDF, Word (.docx), Markdown or text — up to 4&nbsp;MB each
        </span>
      </button>

      {/*
        The warning belongs here, not only on the privacy page.

        Document text is sent to a third-party model provider, and this
        deployment is on that provider's free tier — under whose standard terms
        submitted content may be used to improve their services. Someone deciding
        what to upload is deciding it *at this control*, and a caveat they would
        have to go looking for is a caveat written for the writer rather than the
        reader.

        It stays until the deployment is on a paid tier or covered by written
        data-processing terms, at which point this sentence and the matching
        paragraph on the privacy page change together.
      */}
      <p className="text-muted-foreground mt-2 text-xs">
        Document text is sent to Google&rsquo;s Gemini API for processing, on a
        free tier — please don&rsquo;t upload anything confidential.{" "}
        <Link href="/privacy" className="underline">
          What is stored
        </Link>
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        // The visible control is the button above; this input exists only to
        // open the picker. `sr-only` rather than `hidden` so it stays reachable
        // to assistive technology that prefers the native control.
        aria-label="Choose documents to upload"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {files.length > 0 ? (
        <ul aria-live="polite" className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="border-border/60 flex items-start gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              {file.state === "rejected" ? (
                <AlertCircle
                  aria-hidden="true"
                  className="text-destructive mt-0.5 size-4 shrink-0"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                {file.message ? (
                  <p className="text-destructive mt-0.5">{file.message}</p>
                ) : (
                  <p className="text-muted-foreground mt-0.5">
                    {file.state === "uploading" ? "Uploading…" : "Queued"}
                  </p>
                )}
              </div>

              {file.state === "rejected" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((entry) => entry.id !== file.id),
                    )
                  }
                >
                  Dismiss
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
