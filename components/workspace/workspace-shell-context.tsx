"use client";

import { createContext, useContext } from "react";

import type { ChatSource } from "@/lib/ai/types";

/** Context because the chat arrives as `children`, which a layout cannot pass
 * props to. Live shell state only — the rest stays a prop (ADR 041). */
export type WorkspaceShellValue = {
  /** Tracks uploads as they finish, so it cannot be handed down frozen. */
  hasReadyDocuments: boolean;
  readyFilenames: readonly string[];
  /** One panel, two openers: a citation here, a document in the list. */
  openSource: (source: ChatSource) => void;
  openChunkId: string | null;
};

const WorkspaceShellContext = createContext<WorkspaceShellValue | null>(null);

export const WorkspaceShellProvider = WorkspaceShellContext.Provider;

export function useWorkspaceShell(): WorkspaceShellValue {
  const value = useContext(WorkspaceShellContext);

  if (!value) {
    throw new Error(
      "useWorkspaceShell must be used inside the workspace layout",
    );
  }

  return value;
}
