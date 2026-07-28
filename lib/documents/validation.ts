/**
 * What we accept from an upload form.
 *
 * The governing assumption is that **nothing the client sends about a file is
 * true**. A browser's `File.type` is derived from the extension, an attacker's
 * is whatever they typed. So the declared MIME type is never used to choose a
 * parser — the extension proposes a type and the file's own leading bytes have
 * to agree before anything opens it.
 *
 * This is pure and synchronous: it inspects a byte prefix, touches no network,
 * and writes nothing. Rejection here is the cheapest possible outcome, which is
 * the point of doing it before a row is created.
 */

/** 4 MB. Large enough for a long report, small enough to hold in memory safely. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
} as const;

export type AcceptedExtension = keyof typeof ACCEPTED_EXTENSIONS;

/** For the file input's `accept` attribute, so the picker filters up front. */
export const ACCEPT_ATTRIBUTE = ".pdf,.docx,.md,.markdown,.txt";

export type ValidationFailure =
  "empty" | "too-large" | "unsupported-extension" | "content-mismatch";

export type ValidationResult =
  | { ok: true; mimeType: string; extension: AcceptedExtension }
  | { ok: false; reason: ValidationFailure; message: string };

function extensionOf(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot + 1).toLowerCase();
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

/** `%PDF-` */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;
/** `PK\x03\x04` — docx is a ZIP archive. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

/**
 * Whether the bytes look like the format the extension claims.
 *
 * Text formats have no signature, so there is nothing to check here — an
 * invalid-UTF-8 `.txt` is caught by the decoder during extraction, which is the
 * only place that can tell. Claiming to verify text here would be theatre.
 */
function contentMatchesExtension(
  extension: AcceptedExtension,
  bytes: Uint8Array,
): boolean {
  switch (extension) {
    case "pdf":
      return startsWith(bytes, PDF_MAGIC);
    case "docx":
      return startsWith(bytes, ZIP_MAGIC);
    case "md":
    case "markdown":
    case "txt":
      return true;
  }
}

export function validateUpload(
  filename: string,
  bytes: Uint8Array,
): ValidationResult {
  if (bytes.length === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "This file is empty.",
    };
  }

  if (bytes.length > MAX_FILE_BYTES) {
    const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
    const actualMb = (bytes.length / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      reason: "too-large",
      message: `This file is ${actualMb} MB. The limit is ${limitMb} MB.`,
    };
  }

  const extension = extensionOf(filename);

  if (!(extension in ACCEPTED_EXTENSIONS)) {
    return {
      ok: false,
      reason: "unsupported-extension",
      message: `${extension ? `.${extension} files are` : "Files without an extension are"} not supported. Upload a PDF, Word document (.docx), Markdown or text file.`,
    };
  }

  const accepted = extension as AcceptedExtension;

  if (!contentMatchesExtension(accepted, bytes)) {
    // A renamed file, or something disguised. Refuse rather than hand it to a
    // parser and hope: the parser is where untrusted input becomes dangerous.
    return {
      ok: false,
      reason: "content-mismatch",
      message: `This file is named .${extension} but its contents are not a valid ${accepted === "pdf" ? "PDF" : "Word document"}.`,
    };
  }

  return {
    ok: true,
    mimeType: ACCEPTED_EXTENSIONS[accepted],
    extension: accepted,
  };
}
