import { NextResponse } from "next/server";

import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import {
  deleteDocumentInWorkspace,
  findDocumentInWorkspace,
} from "@/lib/documents/queries";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const { workspaceId, documentId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "read");
  if (isDenied(auth)) return auth;

  const document = await findDocumentInWorkspace(auth.workspaceId, documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ document });
}

/**
 * Real deletion.
 *
 * Chunks and their embeddings go with the row via `ON DELETE CASCADE`, and the
 * extracted text is a column on the document rather than a file elsewhere — so
 * there is nothing left behind and nothing to orphan.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; documentId: string }> },
) {
  const { workspaceId, documentId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "write");
  if (isDenied(auth)) return auth;

  const deleted = await deleteDocumentInWorkspace(auth.workspaceId, documentId);
  if (!deleted) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
