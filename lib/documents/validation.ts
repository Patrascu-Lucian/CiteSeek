/**
 * **Nothing the client sends about a file is true** — `File.type` is derived from
 * the extension, or from whatever an attacker typed. The declared MIME type never
 * chooses a parser: the extension proposes, the leading bytes must agree.
 *
 * Pure and synchronous, so rejection costs a byte prefix and no row.
 */

/** 4 MB. Large enough for a long report, small enough to hold in memory safely. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Multipart wraps the file in a boundary, part headers and CRLFs, so the body is
 * always larger than the file it carries. Deliberately generous: this only has to
 * catch the obviously oversized. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export function tooLargeMessage(totalBytes: number): string {
  const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
  const actualMb = (totalBytes / (1024 * 1024)).toFixed(1);
  return `This file is ${actualMb} MB. The limit is ${limitMb} MB.`;
}

/**
 * The declared body size, when no valid upload could be that big — so the caller
 * can refuse before reading a body it was always going to reject.
 *
 * **Not a replacement for `validateUpload`.** The header is client-supplied and
 * can lie, and a chunked upload sends none at all, so the post-read check is the
 * authority and this is only an early out.
 */
export function declaredBodyTooLarge(
  contentLength: string | null,
): number | null {
  if (contentLength === null) return null;

  const declared = Number(contentLength);
  if (!Number.isFinite(declared)) return null;

  return declared > MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES ? declared : null;
}

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

/** Text formats have no signature — invalid UTF-8 is caught by the decoder during
 * extraction, the only place that can tell. Verifying it here would be theatre. */
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

/** `bytes` need only be the leading bytes. The browser passes `File.size` as
 * `totalBytes`, so an oversized file is rejected after reading 8 bytes. */
export function validateUpload(
  filename: string,
  bytes: Uint8Array,
  totalBytes: number = bytes.length,
): ValidationResult {
  if (totalBytes === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "This file is empty.",
    };
  }

  if (totalBytes > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: tooLargeMessage(totalBytes),
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
