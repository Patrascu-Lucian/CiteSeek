import { NextResponse, after } from "next/server";

import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import {
  createQueuedDocument,
  failStaleProcessing,
  listDocuments,
} from "@/lib/documents/queries";
import { validateUpload } from "@/lib/documents/validation";
import { processDocument } from "@/lib/rag/ingest";
import { clientIpHash } from "@/lib/usage/client-ip";
import { enforceUsageLimits } from "@/lib/usage/enforce";
import { pruneUsageEvents, recordUsage } from "@/lib/usage/queries";

/** Node, not Edge: `node:crypto` and PDF parsing exist on neither. */
export const runtime = "nodejs";

/** The ceiling `after()` runs under. Longer documents are killed mid-flight,
 * which the stale-processing watchdog cleans up. */
export const maxDuration = 300;

/** The documents list, plus a sweep for abandoned jobs. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "read");
  if (isDenied(auth)) return auth;

  // Looking at a stuck document is what unsticks it — no cron, and the only
  // client that cares is already polling.
  await failStaleProcessing();

  // Swept from a request, like stale documents: no scheduler exists.
  await pruneUsageEvents();

  return NextResponse.json({
    documents: await listDocuments(auth.workspaceId),
  });
}

/** Validates, creates the row, responds, *then* works via `after()`. A 50-page PDF
 * would otherwise hold the request open for minutes. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "write");
  if (isDenied(auth)) return auth;

  const ipHash = clientIpHash(request.headers);

  // Metered too: one upload embeds in many batches and costs far more quota than
  // a question, so limiting chat alone leaves the expensive door open.
  const refused = await enforceUsageLimits(auth, ipHash);
  if (refused) return refused;

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
    const { embeddingTokens } = await processDocument(
      auth.workspaceId,
      document.id,
      bytes,
      validation.mimeType,
    );

    // Inside `after()`: the response has gone and tokens are only known once
    // embedding finishes.
    await recordUsage({
      actorType: auth.actorType,
      actorId: auth.actorId,
      ipHash,
      workspaceId: auth.workspaceId,
      kind: "embedding",
      inputTokens: embeddingTokens,
    });
  });

  return NextResponse.json(
    { document: { id: document.id, filename: document.filename } },
    { status: 201 },
  );
}
