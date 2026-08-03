import { type PageSpan, joinPages, normalizeText } from "./normalize";

/**
 * Uploaded bytes to canonical text. Every format converges on a normalized
 * string plus page spans where pages exist — docx, markdown and text report null
 * rather than pretending everything is page 1.
 *
 * Parsers are pure JavaScript so parsing untrusted uploads is safe by
 * construction: nothing shells out, and bytes are never written to disk.
 */

export const SUPPORTED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/markdown": "text",
  "text/plain": "text",
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_MIME_TYPES;

export type ExtractedDocument = {
  /** Canonical text. Every stored offset indexes into this string. */
  text: string;
  /** Null for formats with no page concept. */
  pageSpans: PageSpan[] | null;
  /** Null for formats with no page concept. */
  pageCount: number | null;
};

export function isSupportedMimeType(
  mimeType: string,
): mimeType is SupportedMimeType {
  return mimeType in SUPPORTED_MIME_TYPES;
}

/** Separate from unexpected failures, so ingestion can tell "unusable file"
 * (report and stop) from "something broke" (worth retrying). */
export class UnreadableDocumentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UnreadableDocumentError";
  }
}

/**
 * PDF.js takes ownership of the array and **detaches it**. Measured: 68,066 bytes
 * before the call, **0 after**, with a second call throwing "may be corrupt or
 * password-protected" about a file that is neither. Extract the same buffer
 * twice and you must pass a fresh copy.
 */
async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { extractText } = await import("unpdf");

  let totalPages: number;
  let pages: string[];

  try {
    // `mergePages: false` is the whole reason PDFs can carry page numbers --
    // a merged string would leave no way to say which page a passage came from.
    const result = await extractText(bytes, { mergePages: false });
    totalPages = result.totalPages;
    pages = Array.isArray(result.text) ? result.text : [result.text];
  } catch (cause) {
    throw new UnreadableDocumentError(
      "This PDF could not be read. It may be corrupt or password-protected.",
      { cause },
    );
  }

  const { text, pageSpans } = joinPages(pages);

  if (text.length === 0) {
    // Almost always a scan: images with no text layer. Saying so is actionable;
    // "empty document" is not.
    throw new UnreadableDocumentError(
      "No text could be extracted from this PDF. If it is a scan, it needs OCR before it can be searched.",
    );
  }

  return { text, pageSpans, pageCount: totalPages };
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  const mammoth = await import("mammoth");

  let raw: string;
  try {
    // `extractRawText`, not `convertToHtml`: markup would need stripping before
    // offsets meant anything, and every transformation risks drift.
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(bytes),
    });
    raw = result.value;
  } catch (cause) {
    throw new UnreadableDocumentError(
      "This Word document could not be read. It may be corrupt or in an older .doc format.",
      { cause },
    );
  }

  const text = normalizeText(raw);

  if (text.length === 0) {
    throw new UnreadableDocumentError(
      "This Word document appears to contain no text.",
    );
  }

  // Word documents paginate at render time, not in the file, so there is no page
  // number to report honestly.
  return { text, pageSpans: null, pageCount: null };
}

function extractPlainText(bytes: Uint8Array): ExtractedDocument {
  // `fatal: true` rejects invalid UTF-8 rather than silently substituting
  // replacement characters, which would corrupt both the text and its offsets.
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new UnreadableDocumentError("This file is not valid UTF-8 text.", {
      cause,
    });
  }

  const text = normalizeText(decoded);

  if (text.length === 0) {
    throw new UnreadableDocumentError("This file is empty.");
  }

  return { text, pageSpans: null, pageCount: null };
}

export async function extractText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<ExtractedDocument> {
  if (!isSupportedMimeType(mimeType)) {
    throw new UnreadableDocumentError(
      `Unsupported file type: ${mimeType}. Supported types are PDF, Word (.docx), Markdown and plain text.`,
    );
  }

  switch (SUPPORTED_MIME_TYPES[mimeType]) {
    case "pdf":
      return extractPdf(bytes);
    case "docx":
      return extractDocx(bytes);
    case "text":
      return extractPlainText(bytes);
  }
}
