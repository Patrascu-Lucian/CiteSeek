import { NextResponse, after } from "next/server";

import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import { findDocumentInWorkspace } from "@/lib/documents/queries";
import { resumeEmbedding } from "@/lib/rag/ingest";
import { clientIpHash } from "@/lib/usage/client-ip";
import { recordUsage } from "@/lib/usage/queries";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Retry a failed document.
 *
 * Only embedding is retried, never extraction. A document that failed while
 * parsing has no chunks to resume, and re-running a parser that already rejected
 * the file would fail identically — so the caller is told to delete and
 * re-upload instead of being given a button that quietly does nothing.
 *
 * `resumeEmbedding` skips chunks that already have vectors, so a retry after a
 * rate limit costs only the remainder rather than the whole document again.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const { workspaceId, documentId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "write");
  if (isDenied(auth)) return auth;

  const document = await findDocumentInWorkspace(auth.workspaceId, documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.status !== "failed") {
    return NextResponse.json(
      { error: "Only a failed document can be retried." },
      { status: 409 },
    );
  }

  if (!document.contentText) {
    return NextResponse.json(
      {
        error:
          "This document could not be read, so there is nothing to retry. Delete it and upload the file again.",
        reason: "unrecoverable",
      },
      { status: 409 },
    );
  }

  const ipHash = clientIpHash(request.headers);

  after(async () => {
    const { embeddingTokens } = await resumeEmbedding(
      auth.workspaceId,
      documentId,
    );

    await recordUsage({
      actorType: auth.actorType,
      actorId: auth.actorId,
      ipHash,
      workspaceId: auth.workspaceId,
      kind: "embedding",
      inputTokens: embeddingTokens,
    });
  });

  return NextResponse.json({ retrying: true }, { status: 202 });
}
