import { NextResponse, after } from "next/server";

import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import {
  createQueuedDocument,
  failStaleProcessing,
  listDocuments,
} from "@/lib/documents/queries";
import { validateUpload } from "@/lib/documents/validation";
import { processDocument } from "@/lib/rag/ingest";

/**
 * Node runtime, not Edge: ingestion uses `node:crypto` (via the fake embedder)
 * and PDF parsing, neither of which exists on Edge.
 */
export const runtime = "nodejs";

/**
 * The ceiling `after()` work runs under. Ingestion is bounded by this — a
 * document that needs longer is killed mid-flight, which is what the
 * stale-processing watchdog exists to clean up.
 */
export const maxDuration = 300;

/** The documents list, plus a sweep for abandoned jobs. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "read");
  if (isDenied(auth)) return auth;

  // Running the watchdog here means the act of looking at a stuck document is
  // what unsticks it. No cron, no queue -- the only client that cares is the one
  // already polling.
  await failStaleProcessing();

  return NextResponse.json({
    documents: await listDocuments(auth.workspaceId),
  });
}

/**
 * Upload.
 *
 * Validates, creates the row, responds, and only then starts work via `after()`.
 * The response does not wait for parsing or embedding: a 50-page PDF would
 * otherwise hold the request open for minutes, and the client has a status
 * endpoint to poll precisely so it does not have to.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "write");
  if (isDenied(auth)) return auth;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart form upload." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file was included in the upload." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Note the argument list: the client's `file.type` is never consulted. The
  // extension proposes a format and the leading bytes have to agree.
  const validation = validateUpload(file.name, bytes);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.message, reason: validation.reason },
      { status: 400 },
    );
  }

  const document = await createQueuedDocument(auth.workspaceId, {
    filename: file.name,
    mimeType: validation.mimeType,
    sizeBytes: bytes.length,
  });

  after(async () => {
    await processDocument(
      auth.workspaceId,
      document.id,
      bytes,
      validation.mimeType,
    );
  });

  return NextResponse.json(
    { document: { id: document.id, filename: document.filename } },
    { status: 201 },
  );
}
