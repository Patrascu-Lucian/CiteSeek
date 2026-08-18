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
}: {
  /** What happens to a file once it validates. Taken rather than built here,
   * so local mode can keep it in the browser. */
  send: SendFile;
  /** Awaited before the local row clears, so there is no gap where an uploaded
   * file appears nowhere. */
  onUploaded: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<QueuedFile[]>([]);

  async function upload(file: File, id: string) {
    const result = await send(file);

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

    for (const file of Array.from(selected)) {
      const id = crypto.randomUUID();

      // First bytes only, for the signature — reading 4 MB to reject a
      // mislabelled file is wasted work. Size comes from `File.size`.
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
        className={`border-border hover:border-foreground/30 focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none sm:px-6 ${
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

      <input
        ref={inputRef}
        type="file"
        multiple
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
