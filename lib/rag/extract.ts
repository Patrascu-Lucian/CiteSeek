import { type PageSpan, joinPages, normalizeText } from "./normalize";

/**
 * Turning uploaded bytes into canonical text.
 *
 * Every supported format converges on the same shape so the rest of the pipeline
 * has one thing to reason about: a normalized string, plus page spans when the
 * format actually has pages. PDFs do; docx, markdown and plain text do not, and
 * they report null rather than pretending everything is page 1.
 *
 * Parsers here are pure JavaScript by deliberate choice, so that parsing
 * untrusted uploads is safe by construction: `unpdf` ships a serverless PDF.js
 * build and `mammoth` reads the docx
 * ZIP directly. Neither shells out, and uploaded bytes are never written to disk
 * or executed — they exist only in the request's memory and are discarded once
 * the text is extracted.
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

/**
 * Thrown for input we cannot read. Separated from unexpected failures so the
 * ingestion pipeline can tell "this file is unusable" (report it to the user and
 * stop) from "something broke" (worth retrying).
 */
export class UnreadableDocumentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UnreadableDocumentError";
  }
}

/**
 * Note: PDF.js takes ownership of the array it is given and **detaches it**.
 * After this call `bytes.length` is 0, and any later read of the same array sees
 * an empty buffer rather than an error.
 *
 * Nothing here depends on that today — the upload route records `sizeBytes`
 * before dispatching, and no format falls back to a second parser. It is
 * documented because the failure it would cause is silent: a fallback parser
 * handed the same array would simply find an empty document.
 *
 * Measured, when a test read one fixture twice: 68,066 bytes before the call and
 * **0 after**, with the second call throwing "could not be read. It may be
 * corrupt or password-protected" — about a file that is neither. Any caller
 * extracting the same buffer more than once has to hand over a fresh copy.
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
    // Almost always a scanned PDF: pages of images with no text layer. Saying so
    // is more useful than reporting an empty document, because the user can act
    // on it.
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
    // `extractRawText` rather than `convertToHtml`: markup would have to be
    // stripped again before offsets meant anything, and every transformation
    // between extraction and measurement is a chance for them to drift.
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
