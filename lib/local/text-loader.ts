import type { LoadDocumentText } from "@/components/chat/source-panel";

import { getLocalDocument } from "./store";

/**
 * The same contract as the workspace loader, reading IndexedDB instead of a
 * route. This is what makes a local citation resolve by the identical offsets a
 * cloud one does — the panel cannot tell the two apart.
 */
export const localDocumentText: LoadDocumentText = async (documentId) => {
  const document = await getLocalDocument(documentId);

  if (!document) return { status: "unavailable", reason: "deleted" };

  return document.text
    ? { status: "loaded", contentText: document.text }
    : { status: "unavailable", reason: "no-text" };
};
