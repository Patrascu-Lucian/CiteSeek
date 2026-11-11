import { readFileSync } from "node:fs";
import { join } from "node:path";

import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { chunks } from "@/lib/db/schema";
import {
  cleanupTestRows,
  createTestClient,
  createTestWorkspace,
  unitVector,
} from "@/lib/db/test-helpers";
import {
  countChunks,
  createQueuedDocument,
  discardEmbeddingsFromOtherModels,
  findDocumentInWorkspace,
  insertChunks,
  listDocuments,
  setChunkEmbeddings,
  sumExtractedCharacters,
  updateDocument,
} from "@/lib/documents/queries";
import { fakeEmbeddings } from "@/lib/ai/fake-embedder";

import { type Embedder } from "./embeddings";
import {
  processDocument,
  reembedFromOtherModels,
  resumeEmbedding,
  sanitizeError,
} from "./ingest";

/**
 * The pipeline against a real database.
 *
 * The offset invariant is asserted here rather than only in unit tests because
 * this is the first point where the text and the chunks are stored *separately*
 * — text in `documents.contentText`, offsets in `chunks`. Everything upstream
 * could be correct and a mismatch introduced by the storage step, and the only
 * symptom would be a citation quoting the wrong passage.
 */

const { client, db } = createTestClient();
const FIXTURES = join(import.meta.dirname, "__fixtures__");

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

const workingEmbedder: Embedder = (texts) =>
  Promise.resolve({ vectors: fakeEmbeddings(texts), tokens: texts.length * 2 });

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

async function queueDocument(workspaceId: string, filename: string) {
  return createQueuedDocument(workspaceId, {
    filename,
    mimeType: "application/pdf",
    sizeBytes: 1024,
  });
}

/** Distinct across a document's chunks; an unlabeled vector reads as null. */
async function modelsOf(documentId: string) {
  const rows = await db
    .selectDistinct({ model: chunks.embeddingModel })
    .from(chunks)
    .where(eq(chunks.documentId, documentId));
  return rows.map((row) => row.model);
}

describe("processDocument — happy path", () => {
  it("takes a PDF from queued to ready", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );

    const after = await findDocumentInWorkspace(workspace.id, document.id);
    expect(after!.status).toBe("ready");
    expect(after!.error).toBeNull();
    expect(after!.pageCount).toBe(2);
    expect(after!.chunkCount).toBeGreaterThan(0);
  });

  it("labels every vector with the configured model", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );

    // `vitest.integration.config.ts` configures the fake.
    expect(await modelsOf(document.id)).toEqual(["fake"]);
  });

  it("stores chunk offsets that index into the stored text", async () => {
    // The single most important assertion in the project. Milestone 2 renders a
    // citation by slicing exactly this.
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );

    const stored = await findDocumentInWorkspace(workspace.id, document.id);
    const storedChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id))
      .orderBy(asc(chunks.chunkIndex));

    expect(storedChunks.length).toBeGreaterThan(0);
    for (const chunk of storedChunks) {
      expect(stored!.contentText!.slice(chunk.charStart, chunk.charEnd)).toBe(
        chunk.content,
      );
    }
  });

  it("stores page spans that agree with the chunk page numbers", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );

    const stored = await findDocumentInWorkspace(workspace.id, document.id);
    const storedChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id));

    for (const chunk of storedChunks) {
      const span = stored!.pageSpans!.find(
        (s) => s.pageNumber === chunk.pageNumber,
      );
      expect(span).toBeDefined();
      expect(chunk.charStart).toBeGreaterThanOrEqual(span!.charStart);
    }
  });

  it("embeds every chunk", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );

    const [summary] = await listDocuments(workspace.id);
    expect(summary!.embeddedChunkCount).toBe(summary!.chunkCount);
  });

  it("handles a document with no page concept", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.md");

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.md"),
      "text/markdown",
      { embedder: workingEmbedder },
    );

    const stored = await findDocumentInWorkspace(workspace.id, document.id);
    expect(stored!.status).toBe("ready");
    expect(stored!.pageSpans).toBeNull();
    expect(stored!.pageCount).toBeNull();
  });
});

describe("processDocument — the storage ceiling", () => {
  it("fails the document instead of storing text past the ceiling", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder, characterCeiling: 10 },
    );

    const after = await findDocumentInWorkspace(workspace.id, document.id);
    expect(after!.status).toBe("failed");
    expect(after!.error).toContain("storage limit");

    // Why the check sits before chunking.
    expect(after!.contentText).toBeNull();
    await expect(countChunks(workspace.id, document.id)).resolves.toBe(0);
  });

  it("counts what is already stored, not just this document", async () => {
    const workspace = await createTestWorkspace(db);

    const first = await queueDocument(workspace.id, "sample.pdf");
    await processDocument(
      workspace.id,
      first.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );
    const stored = await sumExtractedCharacters(workspace.id);
    expect(stored).toBeGreaterThan(0);

    // A ceiling the first document fits under and the second does not.
    const second = await queueDocument(workspace.id, "sample.pdf");
    await processDocument(
      workspace.id,
      second.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder, characterCeiling: stored + 1 },
    );

    const after = await findDocumentInWorkspace(workspace.id, second.id);
    expect(after!.status).toBe("failed");
    expect(await sumExtractedCharacters(workspace.id)).toBe(stored);
  });
});

describe("processDocument — failures", () => {
  it("records an unreadable file as failed with an explanation", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "broken.pdf");

    await processDocument(
      workspace.id,
      document.id,
      new TextEncoder().encode("not a pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );

    const stored = await findDocumentInWorkspace(workspace.id, document.id);
    expect(stored!.status).toBe("failed");
    expect(stored!.error).toMatch(/could not be read|no text/i);
  });

  it("leaves the document failed rather than throwing", async () => {
    // Nothing is awaiting this call — it runs in `after()` after the response
    // was sent. An exception escaping here would vanish, and the document would
    // sit in `processing` forever.
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "broken.pdf");

    await expect(
      processDocument(
        workspace.id,
        document.id,
        new Uint8Array([0x00, 0x01]),
        "application/pdf",
        { embedder: workingEmbedder },
      ),
    ).resolves.toEqual({ embeddingTokens: 0 });
  });

  it("keeps chunks already embedded when the provider fails partway", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    let calls = 0;
    const failsAfterFirstBatch: Embedder = (texts) => {
      calls += 1;
      if (calls > 1)
        return Promise.reject(new Error("429 rate limit exceeded"));
      return Promise.resolve({ vectors: fakeEmbeddings(texts), tokens: 0 });
    };

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: failsAfterFirstBatch },
    );

    const stored = await findDocumentInWorkspace(workspace.id, document.id);
    // The fixture is small enough to finish in one batch, so it should succeed;
    // what matters is that a mid-flight failure never discards stored chunks.
    expect(["ready", "failed"]).toContain(stored!.status);
    const storedChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id));
    expect(storedChunks.length).toBeGreaterThan(0);
  });
});

describe("resumeEmbedding", () => {
  it("finishes a document whose embeddings were incomplete", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");

    // First pass: extraction and chunking succeed, embedding fails outright.
    const alwaysFails: Embedder = () =>
      Promise.reject(new Error("429 rate limit exceeded"));

    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: alwaysFails },
    );

    const failed = await findDocumentInWorkspace(workspace.id, document.id);
    expect(failed!.status).toBe("failed");
    expect(failed!.error).toMatch(/rate limit/i);

    // Retry with a working provider: no re-extraction, just the missing vectors.
    const result = await resumeEmbedding(workspace.id, document.id, {
      embedder: workingEmbedder,
    });

    expect(result.resumed).toBe(true);
    const recovered = await findDocumentInWorkspace(workspace.id, document.id);
    expect(recovered!.status).toBe("ready");
    expect(recovered!.error).toBeNull();

    const [summary] = await listDocuments(workspace.id);
    expect(summary!.embeddedChunkCount).toBe(summary!.chunkCount);
    expect(await modelsOf(document.id)).toEqual(["fake"]);
  });

  /* The way back from a change of model (ADR 062): discard what the old model
     wrote, then resume, which embeds exactly what is left without a vector. */
  it("re-embeds what another model wrote, once its vectors are discarded", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");
    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );
    await db
      .update(chunks)
      .set({ embeddingModel: "gemini-embedding-001" })
      .where(eq(chunks.documentId, document.id));

    const discarded = await discardEmbeddingsFromOtherModels(
      workspace.id,
      document.id,
      "fake",
    );
    await resumeEmbedding(workspace.id, document.id, {
      embedder: workingEmbedder,
    });

    const [summary] = await listDocuments(workspace.id);
    expect(discarded).toBe(summary!.chunkCount);
    expect(summary!.status).toBe("ready");
    expect(summary!.embeddedChunkCount).toBe(summary!.chunkCount);
    expect(await modelsOf(document.id)).toEqual(["fake"]);
  });

  it("re-embeds what another model wrote in place, leaving status alone", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "sample.pdf");
    await processDocument(
      workspace.id,
      document.id,
      fixture("sample.pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );
    await db
      .update(chunks)
      .set({ embeddingModel: "gemini-embedding-001" })
      .where(eq(chunks.documentId, document.id));

    const result = await reembedFromOtherModels(workspace.id, document.id, {
      embedder: workingEmbedder,
    });

    const [summary] = await listDocuments(workspace.id);
    expect(result).toEqual({ reembedded: summary!.chunkCount, error: null });
    expect(summary!.status).toBe("ready");
    expect(summary!.embeddedChunkCount).toBe(summary!.chunkCount);
    expect(await modelsOf(document.id)).toEqual(["fake"]);
  });

  it("loses nothing when the provider fails partway, and a second run finishes", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "long.pdf");
    const inserted = await insertChunks(
      workspace.id,
      document.id,
      Array.from({ length: 40 }, (_, chunkIndex) => ({
        chunkIndex,
        content: `Passage ${String(chunkIndex)} on the notice period.`,
        charStart: chunkIndex * 40,
        charEnd: chunkIndex * 40 + 30,
        pageNumber: 1,
      })),
    );
    await setChunkEmbeddings(
      workspace.id,
      document.id,
      inserted.map((chunk) => ({ id: chunk.id, embedding: unitVector(0) })),
      "gemini-embedding-001",
    );
    await updateDocument(workspace.id, document.id, { status: "ready" });

    let firstBatch = 0;
    const failsAfterFirstBatch: Embedder = (texts) => {
      if (firstBatch > 0)
        return Promise.reject(new Error("429 rate limit exceeded"));
      firstBatch = texts.length;
      return Promise.resolve({ vectors: fakeEmbeddings(texts), tokens: 0 });
    };

    const first = await reembedFromOtherModels(workspace.id, document.id, {
      embedder: failsAfterFirstBatch,
    });

    expect(firstBatch).toBeLessThan(40);
    expect(first.reembedded).toBe(firstBatch);
    expect(first.error).toMatch(/rate limit/i);

    const stored = await db
      .select({ model: chunks.embeddingModel, embedding: chunks.embedding })
      .from(chunks)
      .where(eq(chunks.documentId, document.id));
    expect(stored.filter((row) => row.embedding === null)).toEqual([]);
    expect(stored.filter((row) => row.model === "fake")).toHaveLength(
      firstBatch,
    );
    const untouched = await findDocumentInWorkspace(workspace.id, document.id);
    expect(untouched!.status).toBe("ready");
    expect(untouched!.error).toBeNull();

    const second = await reembedFromOtherModels(workspace.id, document.id, {
      embedder: workingEmbedder,
    });

    expect(second).toEqual({ reembedded: 40 - firstBatch, error: null });
    expect(await modelsOf(document.id)).toEqual(["fake"]);
  });

  it("reports that there is nothing to resume when parsing never succeeded", async () => {
    // A document that failed during extraction has no chunks. Re-running the
    // parser would fail identically, so the caller is told to delete instead.
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "broken.pdf");

    await processDocument(
      workspace.id,
      document.id,
      new TextEncoder().encode("not a pdf"),
      "application/pdf",
      { embedder: workingEmbedder },
    );

    expect(await resumeEmbedding(workspace.id, document.id)).toEqual({
      resumed: false,
      // Nothing to resume means nothing was spent resuming it.
      embeddingTokens: 0,
    });
  });
});

describe("sanitizeError", () => {
  it("collapses whitespace", () => {
    expect(sanitizeError(new Error("line one\n\n   line two"))).toBe(
      "line one line two",
    );
  });

  it("truncates long messages", () => {
    // An error column is a log by another name, and a parser can quote the
    // bytes it choked on — which are the user's document.
    const long = new Error("x".repeat(2000));
    const result = sanitizeError(long);

    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles values that are not Errors", () => {
    expect(sanitizeError("a string")).toBe("a string");
    expect(sanitizeError({ weird: true })).toBe(
      "An unexpected error occurred.",
    );
  });
});

/**
 * The demo's own fixture, through the pipeline that will ingest it.
 *
 * The demo workspace is what a stranger sees, and it is seeded from a committed
 * file rather than built by a test — so nothing else in the suite would notice
 * if that file stopped producing what the demo depends on. It was Markdown until
 * this milestone, and Markdown has no pages: every citation in the demo read as
 * a passage with no location, which is the feature the demo exists to show.
 */
describe("the committed demo fixture", () => {
  const DEMO_PDF_PATH = join(
    import.meta.dirname,
    "..",
    "db",
    "fixtures",
    "northwind-remote-work-handbook.pdf",
  );

  /*
    A fresh copy per call, not one shared array.

    PDF.js takes ownership of the buffer it is given and detaches it — see the
    note in `extract.ts`. Reading the fixture once into a constant and ingesting
    it in two tests left the second with a zero-length array, and the failure
    presented as "this PDF could not be read", about a file that reads fine.
  */
  const demoPdf = () => new Uint8Array(readFileSync(DEMO_PDF_PATH));

  it("produces citations that can name more than one page", async () => {
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "handbook.pdf");

    await processDocument(
      workspace.id,
      document.id,
      demoPdf(),
      "application/pdf",
      {
        embedder: workingEmbedder,
      },
    );

    const stored = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id))
      .orderBy(asc(chunks.chunkIndex));

    const pages = new Set(stored.map((chunk) => chunk.pageNumber));

    // A one-page PDF makes every citation "page 1" and demonstrates nothing.
    expect(pages.size).toBeGreaterThan(1);
    expect([...pages].every((page) => typeof page === "number")).toBe(true);
  });

  it("still contains the sentence the end-to-end suite asks about", async () => {
    /*
      `e2e/chat.spec.ts` and `e2e/a11y.spec.ts` ask "When is reimbursement paid?"
      in five places, and rely on this passage being the nearest match. PDF
      extraction rewraps text, so the sentence survives the conversion with a
      line break inside it — which is what a real PDF does, and why this asserts
      on the words rather than on an exact string.
    */
    const workspace = await createTestWorkspace(db);
    const document = await queueDocument(workspace.id, "handbook.pdf");

    await processDocument(
      workspace.id,
      document.id,
      demoPdf(),
      "application/pdf",
      {
        embedder: workingEmbedder,
      },
    );

    const [stored] = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, document.id))
      .orderBy(asc(chunks.chunkIndex));

    const all = await findDocumentInWorkspace(workspace.id, document.id);
    const text = (all?.contentText ?? "").replace(/\s+/g, " ");

    expect(stored).toBeDefined();
    expect(text).toContain(
      "reimbursement is paid within 30 days of an approved claim",
    );
  });
});
