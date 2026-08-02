import { type PageSpan, pageNumberForOffset } from "./normalize";

/**
 * Splitting canonical text into retrievable passages.
 *
 * The governing constraint is not retrieval quality: `text.slice(charStart,
 * charEnd)` must equal `content` for every chunk, because a citation is
 * literally that slice. Drifting offsets produce an app that cites confidently
 * and wrongly, and nothing notices.
 *
 * So this never rewrites text — it only chooses cut points.
 */

/**
 * Revised down from 1,200 / 1,500 / 200 after seeing citations on the deployed
 * app: a 1,200-character chunk makes a *1,200-character highlight*, so the
 * source panel lit up a whole section rather than the "exact source passage" the
 * product claims. **Citation precision is bounded by chunk size and nothing
 * else.**
 *
 * Still not tuned against measured answer quality. This trades context per
 * passage for a sharper citation, since retrieval returns several passages and
 * the reader reads one highlight.
 */
export const CHUNK_TARGET_CHARS = 600;
export const CHUNK_MAX_CHARS = 800;
export const CHUNK_OVERLAP_CHARS = 100;

/**
 * A ceiling on chunks per document, so one pathological upload cannot consume a
 * day's embedding quota. Unchanged by the size revision: quota is spent per
 * embedding call, one per chunk, so this *is* the cost ceiling. The longest
 * supported document roughly halved as a result — ~250 dense pages, still far
 * beyond what this is for.
 */
export const MAX_CHUNKS_PER_DOCUMENT = 600;

export type Chunk = {
  chunkIndex: number;
  content: string;
  charStart: number;
  /** Exclusive. */
  charEnd: number;
  pageNumber: number | null;
};

export class DocumentTooLargeError extends Error {
  constructor(chunkCount: number) {
    super(
      `This document produces ${chunkCount} chunks, above the limit of ${MAX_CHUNKS_PER_DOCUMENT}. Split it into smaller documents.`,
    );
    this.name = "DocumentTooLargeError";
  }
}

type Boundary = { start: number; end: number };

/**
 * Split a range on a separator, keeping absolute offsets.
 *
 * Returns null when the separator does not divide the range, so callers can fall
 * through to a finer strategy rather than looping on a split that achieved
 * nothing.
 */
function splitOn(
  text: string,
  range: Boundary,
  pattern: RegExp,
): Boundary[] | null {
  const slice = text.slice(range.start, range.end);
  const parts: Boundary[] = [];
  let cursor = 0;

  for (const match of slice.matchAll(pattern)) {
    const end = match.index + match[0].length;
    if (end > cursor) {
      parts.push({ start: range.start + cursor, end: range.start + end });
      cursor = end;
    }
  }

  if (cursor < slice.length) {
    parts.push({ start: range.start + cursor, end: range.end });
  }

  return parts.length > 1 ? parts : null;
}

/**
 * Reduce an oversized range to pieces within the maximum, trying progressively
 * finer separators: sentences, then any whitespace, then — for a minified file,
 * a base64 blob, or a language written without spaces — an arbitrary cut. Each
 * fallback loses a little meaning, so it is reached only when the previous one
 * could not help.
 */
function segmentBySize(text: string, range: Boundary): Boundary[] {
  if (range.end - range.start <= CHUNK_MAX_CHARS) return [range];

  for (const pattern of [/(?<=[.!?])[ \n]+/g, /\s+/g]) {
    const parts = splitOn(text, range, pattern);
    if (parts) return parts.flatMap((part) => segmentBySize(text, part));
  }

  const pieces: Boundary[] = [];
  for (let start = range.start; start < range.end; start += CHUNK_MAX_CHARS) {
    pieces.push({ start, end: Math.min(start + CHUNK_MAX_CHARS, range.end) });
  }
  return pieces;
}

/**
 * Break the document into atomic pieces the packer can group.
 *
 * Paragraphs are split *unconditionally*, not only when a range is oversized:
 * they are the strongest semantic boundary extracted text has, and a chunk that
 * runs across one purely because the combined length happened to fit is a worse
 * passage for no benefit. Sizing is the packer's job, below.
 */
function segment(text: string, range: Boundary): Boundary[] {
  const paragraphs = splitOn(text, range, /\n{2,}/g) ?? [range];
  return paragraphs.flatMap((paragraph) => segmentBySize(text, paragraph));
}

/** Trailing context re-attached to the next chunk, cut at a whitespace boundary. */
function overlapStart(
  text: string,
  chunkStart: number,
  chunkEnd: number,
): number {
  const earliest = Math.max(chunkStart, chunkEnd - CHUNK_OVERLAP_CHARS);
  if (earliest <= chunkStart) return chunkEnd;

  // Prefer to begin the overlap at a word boundary; a mid-word start reads as
  // corruption when the passage is shown next to a citation.
  const whitespace = text.slice(earliest, chunkEnd).search(/\s/);
  return whitespace === -1 ? earliest : earliest + whitespace + 1;
}

export function chunkText(
  text: string,
  pageSpans: readonly PageSpan[] | null = null,
): Chunk[] {
  if (text.length === 0) return [];

  const segments = segment(text, { start: 0, end: text.length });
  const chunks: Chunk[] = [];

  let pending: Boundary | null = null;

  const flush = () => {
    if (!pending) return;

    // Trim only by moving the boundaries, never by rewriting the string, so the
    // slice invariant holds.
    let { start, end } = pending;
    while (start < end && /\s/.test(text[start]!)) start += 1;
    while (end > start && /\s/.test(text[end - 1]!)) end -= 1;

    if (end > start) {
      chunks.push({
        chunkIndex: chunks.length,
        content: text.slice(start, end),
        charStart: start,
        charEnd: end,
        pageNumber: pageNumberForOffset(start, pageSpans),
      });
    }

    pending = null;
  };

  for (const piece of segments) {
    if (!pending) {
      pending = { ...piece };
      continue;
    }

    const combinedLength = piece.end - pending.start;

    if (combinedLength <= CHUNK_TARGET_CHARS) {
      pending.end = piece.end;
      continue;
    }

    // Adding this piece would exceed the target. Close the current chunk, then
    // start the next one inside the text just emitted so context spans the seam.
    const closedStart = pending.start;
    const closedEnd = pending.end;
    flush();

    const resumeAt = Math.min(
      overlapStart(text, closedStart, closedEnd),
      piece.start,
    );

    // Overlap is context, not an entitlement: if carrying it forward would push
    // the next chunk past the maximum, drop it. That happens with unbroken runs
    // where each piece is already max-sized -- and where overlapping text has no
    // semantic value to preserve anyway.
    pending =
      piece.end - resumeAt <= CHUNK_MAX_CHARS
        ? { start: resumeAt, end: piece.end }
        : { ...piece };
  }

  flush();

  if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
    throw new DocumentTooLargeError(chunks.length);
  }

  return chunks;
}
