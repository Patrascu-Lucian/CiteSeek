import type { Metadata } from "next";

import { WorkspaceView } from "./workspace-view";

export const metadata: Metadata = { title: "Workspace" };

/**
 * The workspace, opened on whichever conversation was used last.
 *
 * Everything is in `WorkspaceView`, which `/w/<id>/c/<chatId>` also renders — the
 * only difference between the two routes is whether a conversation is named.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return <WorkspaceView workspaceId={workspaceId} />;
}
