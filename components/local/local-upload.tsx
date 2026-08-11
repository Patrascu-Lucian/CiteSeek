"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE } from "@/lib/documents/validation";
import { embedLocalDocument, ingestLocalFile } from "@/lib/local/ingest";

type State =
  | { status: "idle" }
  | { status: "parsing"; filename: string }
  | { status: "embedding"; filename: string; done: number; total: number }
  | { status: "done"; filename: string; passages: number }
  | { status: "failed"; message: string };

export function LocalUpload({ onIngested }: { onIngested: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  async function ingest(file: File) {
    setState({ status: "parsing", filename: file.name });

    const result = await ingestLocalFile(file);

    if (!result.ok) {
      setState({ status: "failed", message: result.message });
      return;
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
      return;
    }

    setState({
      status: "done",
      filename: file.name,
      passages: result.document.chunkCount,
    });
    onIngested();
  }

  const busy = state.status === "parsing" || state.status === "embedding";

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

      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        aria-label="Add a document to local mode"
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file twice fires `change` again.
          event.target.value = "";
          if (file) void ingest(file);
        }}
      />

      <Button
        type="button"
        variant="outline"
        className="mt-3"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Working…" : "Choose a file"}
      </Button>

      <p role="status" className="text-muted-foreground mt-3 text-sm">
        {state.status === "parsing"
          ? `Parsing ${state.filename}…`
          : state.status === "embedding"
            ? `Indexing ${state.filename} — ${String(state.done)} of ${String(state.total)} passages. The model downloads once, then stays on this machine.`
            : state.status === "done"
              ? `${state.filename} — ${state.passages} passage${state.passages === 1 ? "" : "s"} indexed on this machine. Asking questions locally arrives with the model.`
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
