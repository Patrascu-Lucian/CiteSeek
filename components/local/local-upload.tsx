"use client";

import { useRef, useState } from "react";

import { UploadDropzone } from "@/components/documents/upload-dropzone";
import {
  FILE_UNREADABLE,
  embedLocalDocument,
  ingestLocalFile,
} from "@/lib/local/ingest";

type State =
  | { status: "idle" }
  | { status: "parsing"; filename: string }
  | { status: "embedding"; filename: string; done: number; total: number }
  | { status: "done"; passages: number }
  | { status: "failed"; message: string };

export function LocalUpload({ onIngested }: { onIngested: () => void }) {
  const [state, setState] = useState<State>({ status: "idle" });

  /* A ref, not `state`: the dropzone hands files to `ingest` in a loop without
     awaiting, so a second call reads this before any re-render. */
  const working = useRef(false);

  /** The dropzone's `send`. Nothing leaves the browser (ADR 029), so a refusal
   * here is a parse failure rather than a response. */
  async function ingest(file: File) {
    // One status region, one document. Two at once would flip between them.
    if (working.current) {
      return {
        ok: false as const,
        message: "One document at a time in local mode.",
      };
    }

    working.current = true;

    // `finally`, not a reset per exit: a throw escaped all three and left the
    // flag set, so every later upload answered "one at a time" for the life of
    // the tab, with no way back but a reload.
    try {
      setState({ status: "parsing", filename: file.name });

      const result = await ingestLocalFile(file);

      if (!result.ok) {
        setState({ status: "failed", message: result.message });
        return { ok: false as const, message: result.message };
      }

      setState({
        status: "embedding",
        filename: file.name,
        done: 0,
        total: result.document.chunkCount,
      });
      onIngested();

      const embedded = await embedLocalDocument(
        result.document.id,
        (done, total) =>
          setState({ status: "embedding", filename: file.name, done, total }),
      );

      if (!embedded.ok) {
        setState({ status: "failed", message: embedded.message });
        return { ok: false as const, message: embedded.message };
      }

      setState({ status: "done", passages: result.document.chunkCount });
      onIngested();

      return { ok: true as const };
    } catch {
      setState({ status: "failed", message: FILE_UNREADABLE });
      return { ok: false as const, message: FILE_UNREADABLE };
    } finally {
      working.current = false;
    }
  }

  return (
    <section
      aria-labelledby="local-upload"
      className="border-border rounded-md border p-4"
    >
      <h2 id="local-upload" className="text-sm font-medium">
        Add a document
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">
        PDF, Word, Markdown or text. It is parsed on this machine and never
        uploaded.
      </p>

      <div className="mt-3">
        <UploadDropzone
          send={ingest}
          onUploaded={() => Promise.resolve()}
          multiple={false}
        />
      </div>

      <p role="status" className="text-muted-foreground mt-3 text-sm">
        {state.status === "parsing"
          ? `Parsing ${state.filename}…`
          : state.status === "embedding"
            ? `Indexing ${state.filename} — ${String(state.done)} of ${String(state.total)} passages. The model downloads once, then stays on this machine.`
            : state.status === "done"
              ? `Indexed ${String(state.passages)} passage${state.passages === 1 ? "" : "s"} on this machine. Ask about it below.`
              : null}
      </p>

      {state.status === "failed" ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
