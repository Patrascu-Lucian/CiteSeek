import { describe, expect, it } from "vitest";

import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  MULTIPART_OVERHEAD_BYTES,
  declaredBodyTooLarge,
  validateUpload,
} from "./validation";

/** `%PDF-` followed by plausible filler. */
function pdfBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size).fill(0x20);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  return bytes;
}

/** `PK\x03\x04` — the ZIP signature a .docx starts with. */
function docxBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size).fill(0x20);
  bytes.set([0x50, 0x4b, 0x03, 0x04], 0);
  return bytes;
}

function textBytes(content = "hello"): Uint8Array {
  return new TextEncoder().encode(content);
}

describe("validateUpload — accepted files", () => {
  it("accepts a PDF whose bytes match its extension", () => {
    const result = validateUpload("report.pdf", pdfBytes());

    expect(result).toEqual({
      ok: true,
      mimeType: "application/pdf",
      extension: "pdf",
    });
  });

  it("accepts a docx", () => {
    const result = validateUpload("notes.docx", docxBytes());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mimeType).toBe(ACCEPTED_EXTENSIONS.docx);
  });

  it.each(["notes.md", "notes.markdown", "notes.txt"])(
    "accepts %s without a magic-byte check",
    (filename) => {
      // Text formats have no signature. Pretending to verify one would be
      // theatre; invalid UTF-8 is caught by the decoder during extraction,
      // which is the only layer that can actually tell.
      expect(validateUpload(filename, textBytes()).ok).toBe(true);
    },
  );

  it("ignores extension casing", () => {
    expect(validateUpload("REPORT.PDF", pdfBytes()).ok).toBe(true);
  });

  it("uses the last extension in a multi-dot filename", () => {
    expect(validateUpload("q3.report.final.pdf", pdfBytes()).ok).toBe(true);
  });

  it("accepts a file exactly at the size limit", () => {
    expect(validateUpload("big.pdf", pdfBytes(MAX_FILE_BYTES)).ok).toBe(true);
  });
});

describe("validateUpload — rejections", () => {
  it("rejects an empty file", () => {
    const result = validateUpload("empty.pdf", new Uint8Array(0));

    expect(result).toMatchObject({ ok: false, reason: "empty" });
  });

  it("rejects a file one byte over the limit, and says how big it was", () => {
    const result = validateUpload("huge.pdf", pdfBytes(MAX_FILE_BYTES + 1));

    expect(result).toMatchObject({ ok: false, reason: "too-large" });
    if (!result.ok) expect(result.message).toMatch(/4\.0 MB.*limit is 4 MB/);
  });

  it("rejects an unsupported extension by name", () => {
    const result = validateUpload("photo.png", textBytes());

    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported-extension",
    });
    if (!result.ok)
      expect(result.message).toMatch(/\.png files are not supported/);
  });

  it("rejects a file with no extension", () => {
    const result = validateUpload("README", textBytes());

    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported-extension",
    });
    if (!result.ok)
      expect(result.message).toMatch(/without an extension are not supported/);
  });

  it("rejects a trailing-dot filename", () => {
    expect(validateUpload("weird.", textBytes())).toMatchObject({
      ok: false,
      reason: "unsupported-extension",
    });
  });
});

describe("validateUpload — content must match the extension", () => {
  it("rejects an executable renamed to .pdf", () => {
    // The case the magic-byte check exists for: the parser is where untrusted
    // input becomes dangerous, so nothing reaches it on the strength of a
    // filename alone.
    const mzHeader = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]);

    const result = validateUpload("invoice.pdf", mzHeader);

    expect(result).toMatchObject({ ok: false, reason: "content-mismatch" });
    if (!result.ok) expect(result.message).toMatch(/not a valid PDF/);
  });

  it("rejects a text file renamed to .pdf", () => {
    expect(validateUpload("fake.pdf", textBytes("just words"))).toMatchObject({
      ok: false,
      reason: "content-mismatch",
    });
  });

  it("rejects a PDF renamed to .docx", () => {
    // Both are "supported" types; the point is that the bytes must match the
    // extension that selects the parser.
    const result = validateUpload("report.docx", pdfBytes());

    expect(result).toMatchObject({ ok: false, reason: "content-mismatch" });
    if (!result.ok) expect(result.message).toMatch(/not a valid Word document/);
  });

  it("rejects a file too short to contain a signature", () => {
    expect(validateUpload("tiny.pdf", new Uint8Array([0x25]))).toMatchObject({
      ok: false,
      reason: "content-mismatch",
    });
  });

  it("does not care what MIME type the client claimed", () => {
    // There is no parameter for it. A validator that accepted a client MIME
    // type would eventually be called with one. (`totalBytes` has a default, so
    // it does not count toward `.length`.)
    expect(validateUpload.length).toBe(2);
  });

  it("accepts a separate total size, so the browser need not read the whole file", () => {
    // The client passes 8 leading bytes plus `File.size`. Reading 4 MB just to
    // discover the file is too big is wasted work on the user's connection.
    const head = pdfBytes(8);

    expect(validateUpload("big.pdf", head, MAX_FILE_BYTES + 1)).toMatchObject({
      ok: false,
      reason: "too-large",
    });
    expect(validateUpload("fine.pdf", head, 1024).ok).toBe(true);
  });
});

describe("declaredBodyTooLarge", () => {
  const CEILING = MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES;

  it("passes a body carrying a file at the size limit", () => {
    // Multipart adds a boundary and part headers, so a 4 MB file arrives as a
    // body slightly over 4 MB. Rejecting on the file limit would refuse it.
    expect(declaredBodyTooLarge(String(MAX_FILE_BYTES + 512))).toBeNull();
  });

  it("reports the declared size once no valid upload could be that big", () => {
    expect(declaredBodyTooLarge(String(CEILING + 1))).toBe(CEILING + 1);
  });

  it("passes a body exactly at the ceiling", () => {
    expect(declaredBodyTooLarge(String(CEILING))).toBeNull();
  });

  it("passes when the header is absent, because chunked uploads send none", () => {
    // The whole reason the post-read check cannot be removed.
    expect(declaredBodyTooLarge(null)).toBeNull();
  });

  it("passes when the header is not a number rather than guessing", () => {
    expect(declaredBodyTooLarge("banana")).toBeNull();
    // A proxy that joins a repeated header. `Number` gives NaN, and a guess here
    // would be a guess about the size of a body nobody has read.
    expect(declaredBodyTooLarge("4194304, 4194304")).toBeNull();
  });
});
