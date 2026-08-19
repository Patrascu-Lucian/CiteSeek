import { useRef, useState } from "react";
import { AlertCircle, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SendFile } from "@/lib/documents/upload";
import { ACCEPT_ATTRIBUTE, validateUpload } from "@/lib/documents/validation";

/**
 * Validated client-side with **the same function the server runs**, so a rejected
 * file never leaves the machine. The server repeats it regardless — this is a
 * courtesy, not a control.
 *
 * The drop target is a real `<button>`: a div with drag handlers is invisible to
 * keyboard and screen-reader users.
 */

type QueuedFile = {
  id: string;
  name: string;
  state: "uploading" | "queued" | "rejected";
  message?: string;
};

export function UploadDropzone({
  send,
  onUploaded,
  multiple = true,
}: {
  /** What happens to a file once it validates. Taken rather than built here,
   * so local mode can keep it in the browser. */
  send: SendFile;
  /** Awaited before the local row clears, so there is no gap where an uploaded
   * file appears nowhere. */
  onUploaded: () => Promise<void>;
  /** False where the caller takes one at a time — local mode refused everything
   * after the first, for a drop this control had invited. */
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<QueuedFile[]>([]);

  async function upload(file: File, id: string) {
    // A rejecting `send` left the row on "Uploading…", and Dismiss only renders
    // once a row is rejected.
    const result = await send(file).catch(() => ({
      ok: false as const,
      message: "That upload could not be completed. Try again.",
    }));

    if (!result.ok) {
      setFiles((current) =>
        current.map((entry) =>
          entry.id === id
            ? { ...entry, state: "rejected", message: result.message }
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

    // Clearing before the list adopts it leaves the file showing nowhere.
    await onUploaded();
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;

    const chosen = Array.from(selected).slice(0, multiple ? Infinity : 1);

    for (const file of chosen) {
      const id = crypto.randomUUID();

      // First bytes only: reading 4 MB to reject a mislabeled file is wasted
      // work. Guarded per file, or one moved since the picker opened throws out
      // of the loop and silently drops the rest.
      const validation = await file
        .slice(0, 8)
        .arrayBuffer()
        .then((head) =>
          validateUpload(file.name, new Uint8Array(head), file.size),
        )
        .catch(() => ({
          ok: false as const,
          message: "That file could not be read. It may have been moved.",
        }));

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
        className={`border-border hover:border-foreground/30 focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none sm:px-6 ${
          isDragging ? "border-foreground/50 bg-muted/40" : ""
        }`}
      >
        <Upload aria-hidden="true" className="text-muted-foreground size-6" />
        <span className="text-sm font-medium">
          {multiple ? "Drop files here" : "Drop a file here"}, or click to
          browse
        </span>
        <span className="text-muted-foreground text-xs">
          PDF, Word (.docx), Markdown or text — up to 4&nbsp;MB
          {multiple ? " each" : ""}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        // Exists only to open the picker. `sr-only` rather than `hidden`, so
        // assistive technology preferring the native control can still reach it.
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
