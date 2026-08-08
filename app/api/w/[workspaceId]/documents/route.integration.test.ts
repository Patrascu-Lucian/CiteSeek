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
import { listDocuments } from "@/lib/documents/queries";
import { MAX_FILE_BYTES } from "@/lib/documents/validation";
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
