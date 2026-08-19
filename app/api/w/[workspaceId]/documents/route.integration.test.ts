import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type * as NextServer from "next/server";

import type { Actor } from "@/lib/auth/actor";
import {
  cleanupTestRows,
  clearUsageEvents,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";
import type * as DocumentQueries from "@/lib/documents/queries";
import {
  createQueuedDocument,
  listDocuments,
  updateDocument,
} from "@/lib/documents/queries";
import { MAX_FILE_BYTES } from "@/lib/documents/validation";
import { DEFAULT_PLAN_LIMITS } from "@/lib/limits/config";
import type * as Sweeps from "@/lib/sweeps";

/**
 * The documents route against a real database. Only the caller's identity is
 * faked — there is no browser to carry a session cookie.
 */

const currentActor = vi.hoisted(() => ({ value: null as Actor | null }));

vi.mock("@/lib/auth/actor", () => ({
  getActor: () => Promise.resolve(currentActor.value),
}));

// `after()` throws outside a request scope, which a directly-invoked handler has
// no way to create. Dropped rather than run: ingestion is covered elsewhere, and
// what this file is about happens before the response.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: () => {},
}));

const sweeps = vi.hoisted(() => ({
  failStaleProcessing: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("@/lib/documents/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof DocumentQueries>()),
  failStaleProcessing: sweeps.failStaleProcessing,
}));

// The real gate's state is module-level, so "five polls, one sweep" would depend
// on being the first `GET` in the file. The test owns the clock instead.
const clock = vi.hoisted(() => ({ at: 0 }));

vi.mock("@/lib/sweeps", async (importOriginal) => {
  const { atMostEvery } = await importOriginal<typeof Sweeps>();
  return {
    atMostEvery,
    sweepStaleDocuments: atMostEvery(60_000, () => clock.at),
    pruneOldUsage: atMostEvery(60 * 60_000, () => clock.at),
  };
});

function asUser(id: string): Actor {
  return { type: "user", id, name: null, email: null, image: null };
}

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
beforeEach(() => clearUsageEvents(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

async function signedInWorkspace() {
  const user = await createTestUser(db);
  const workspace = await createTestWorkspace(db, { ownerId: user.id });
  currentActor.value = asUser(user.id);
  return workspace;
}

async function send(workspaceId: string, request: Request) {
  const { POST } = await import("./route");
  return POST(request, { params: Promise.resolve({ workspaceId }) });
}

function post(workspaceId: string, init: RequestInit) {
  return send(workspaceId, new Request("http://test/api/documents", init));
}

function multipart(file: File): FormData {
  const body = new FormData();
  body.set("file", file);
  return body;
}

/** The extension proposes a format and the leading bytes have to agree, so a
 * cap test needs a file that would otherwise be accepted. */
function validPdf() {
  const bytes = new Uint8Array(1024).fill(0x20);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return bytes;
}

describe("POST /documents — oversized uploads", () => {
  it("refuses a declared body too large to be a valid upload, without reading it", async () => {
    const workspace = await signedInWorkspace();

    const request = new Request("http://test/api/documents", {
      method: "POST",
      headers: { "content-length": String(500 * 1024 * 1024) },
    });

    // Spied, not inferred from a throwing body or from the status — both looked
    // right and neither works. See `docs/code-review-notes.md`.
    const formData = vi.fn(() => Promise.reject(new Error("body was read")));
    Object.defineProperty(request, "formData", { value: formData });

    const response = await send(workspace.id, request);

    expect(formData).not.toHaveBeenCalled();
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      reason: "too-large",
    });
    await expect(listDocuments(workspace.id)).resolves.toHaveLength(0);
  });

  it("refuses a file that lied about its length, once read", async () => {
    const workspace = await signedInWorkspace();
    const oversized = new File(
      [new Uint8Array(MAX_FILE_BYTES + 1)],
      "huge.pdf",
      { type: "application/pdf" },
    );

    // An honest header would be refused before the body is read, so this declares
    // a small one. It is the case the early out cannot catch, and the reason the
    // post-read check is the authority rather than a duplicate.
    const response = await post(workspace.id, {
      method: "POST",
      body: multipart(oversized),
      headers: { "content-length": "100" },
    });

    expect(response.status).toBe(413);
    await expect(listDocuments(workspace.id)).resolves.toHaveLength(0);
  });

  it("refuses an oversized file that declared no length at all", async () => {
    const workspace = await signedInWorkspace();
    const oversized = new File(
      [new Uint8Array(MAX_FILE_BYTES + 1)],
      "huge.pdf",
      { type: "application/pdf" },
    );

    // A chunked upload sends no `content-length`, which is the other way past
    // the early out.
    const response = await post(workspace.id, {
      method: "POST",
      body: multipart(oversized),
    });

    expect(response.status).toBe(413);
    await expect(listDocuments(workspace.id)).resolves.toHaveLength(0);
  });

  it("accepts a file inside the limit, so the guard refuses only the outsized", async () => {
    const workspace = await signedInWorkspace();
    const pdf = new Uint8Array(1024).fill(0x20);
    pdf.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const response = await post(workspace.id, {
      method: "POST",
      body: multipart(
        new File([pdf], "report.pdf", { type: "application/pdf" }),
      ),
    });

    expect(response.status).toBe(201);
    await expect(listDocuments(workspace.id)).resolves.toHaveLength(1);
  });
});

describe("POST /documents — the document cap", () => {
  const CAP = DEFAULT_PLAN_LIMITS.documents;

  async function fill(workspaceId: string, howMany: number) {
    for (let index = 0; index < howMany; index++) {
      await createQueuedDocument(workspaceId, {
        filename: `filled-${index}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1024,
      });
    }
  }

  it("refuses at the cap without reading the body, and inserts nothing", async () => {
    const workspace = await signedInWorkspace();
    await fill(workspace.id, CAP);

    const request = new Request("http://test/api/documents", {
      method: "POST",
      body: multipart(new File([validPdf()], "one-too-many.pdf")),
    });

    // Spied rather than inferred from the status: the placement *is* the slice,
    // and a check that ran after the buffer would pass every other assertion.
    const formData = vi.fn(() => Promise.reject(new Error("body was read")));
    Object.defineProperty(request, "formData", { value: formData });

    const response = await send(workspace.id, request);

    expect(formData).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "cap_reached",
      cap: "documents",
      limit: CAP,
      current: CAP,
    });
    await expect(listDocuments(workspace.id)).resolves.toHaveLength(CAP);
  });

  it("admits the upload that fills the last slot", async () => {
    const workspace = await signedInWorkspace();
    await fill(workspace.id, CAP - 1);

    const response = await post(workspace.id, {
      method: "POST",
      body: multipart(new File([validPdf()], "last-slot.pdf")),
    });

    expect(response.status).toBe(201);
    await expect(listDocuments(workspace.id)).resolves.toHaveLength(CAP);
  });

  it("tells a reader whose documents all failed which one to delete", async () => {
    const workspace = await signedInWorkspace();
    await fill(workspace.id, CAP);

    const [stuck] = await listDocuments(workspace.id);
    await updateDocument(workspace.id, stuck!.id, {
      status: "failed",
      error: "Could not parse",
    });

    const response = await post(workspace.id, {
      method: "POST",
      body: multipart(new File([validPdf()], "blocked.pdf")),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("failed to process");
  });

  /* The regression a cap counted on the wrong scope would cause, and the reason
     `countDocuments` takes a workspace like every other helper here. */
  it("counts only the workspace being uploaded to", async () => {
    const neighbor = await signedInWorkspace();
    await fill(neighbor.id, CAP);

    const mine = await signedInWorkspace();

    const response = await post(mine.id, {
      method: "POST",
      body: multipart(new File([validPdf()], "mine.pdf")),
    });

    expect(response.status).toBe(201);
    await expect(listDocuments(mine.id)).resolves.toHaveLength(1);
  });
});

describe("POST /documents — the storage ceiling", () => {
  it("refuses a reader already at the ceiling, without reading the body", async () => {
    const workspace = await signedInWorkspace();
    const document = await createQueuedDocument(workspace.id, {
      filename: "big.md",
      mimeType: "text/markdown",
      sizeBytes: 1024,
    });
    await updateDocument(workspace.id, document.id, {
      status: "ready",
      contentText: "x".repeat(DEFAULT_PLAN_LIMITS.extractedCharacters),
    });

    const request = new Request("http://test/api/documents", {
      method: "POST",
      body: multipart(new File([validPdf()], "another.pdf")),
    });
    const formData = vi.fn(() => Promise.reject(new Error("body was read")));
    Object.defineProperty(request, "formData", { value: formData });

    const response = await send(workspace.id, request);

    expect(formData).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ cap: "storage" });
  });

  // Documents first, so a workspace over both hears the cap it can act on.
  it("names the document cap ahead of storage when both are reached", async () => {
    const workspace = await signedInWorkspace();

    for (let index = 0; index < DEFAULT_PLAN_LIMITS.documents; index++) {
      const document = await createQueuedDocument(workspace.id, {
        filename: `filled-${index}.md`,
        mimeType: "text/markdown",
        sizeBytes: 1024,
      });
      await updateDocument(workspace.id, document.id, {
        status: "ready",
        contentText: "x".repeat(DEFAULT_PLAN_LIMITS.extractedCharacters),
      });
    }

    const response = await post(workspace.id, {
      method: "POST",
      body: multipart(new File([validPdf()], "another.pdf")),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ cap: "documents" });
  });
});

describe("GET /documents — housekeeping on a polled path", () => {
  it("sweeps once across a run of polls rather than once per poll", async () => {
    const workspace = await signedInWorkspace();
    const { GET } = await import("./route");

    const poll = () =>
      GET(new Request("http://test/api/documents"), {
        params: Promise.resolve({ workspaceId: workspace.id }),
      });

    // Forward, never back: the gate holds a deadline, so resetting the clock to
    // zero would shut it rather than open it if anything above had polled.
    clock.at += 3_600_000;
    sweeps.failStaleProcessing.mockClear();

    for (let tick = 0; tick < 5; tick++) {
      expect((await poll()).status).toBe(200);
      clock.at += 2_000;
    }
    expect(sweeps.failStaleProcessing).toHaveBeenCalledTimes(1);

    clock.at += 60_000;
    await poll();

    expect(sweeps.failStaleProcessing).toHaveBeenCalledTimes(2);
  });
});
