import type { LoadDocumentText } from "@/components/chat/source-panel";

/**
 * The workspace loader, extracted from `SourcePanel` when local mode needed a
 * second one. A 404 is a deleted document rather than a failure — the panel
 * says so instead of showing an error, because a citation outliving its source
 * is expected, not broken.
 */
export function workspaceDocumentText(workspaceId: string): LoadDocumentText {
  return async (documentId) => {
    const response = await fetch(
      `/api/w/${workspaceId}/documents/${documentId}`,
    );

    if (response.status === 404) {
      return { status: "unavailable", reason: "deleted" };
    }
    if (!response.ok) return { status: "error" };

    const payload = (await response.json()) as {
      document: { contentText: string | null };
    };

    return payload.document.contentText
      ? { status: "loaded", contentText: payload.document.contentText }
      : { status: "unavailable", reason: "no-text" };
  };
}
