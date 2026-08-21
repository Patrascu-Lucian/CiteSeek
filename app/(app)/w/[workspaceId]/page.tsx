import type { Metadata } from "next";

import { CAP_PARAM } from "@/lib/limits/caps";

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
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  /** `createConversation` redirects here with `CAP_PARAM` when the cap refuses;
   * a form POST has no other way to carry a refusal through the navigation. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId } = await params;
  const capReached = (await searchParams)[CAP_PARAM];

  return (
    <WorkspaceView
      workspaceId={workspaceId}
      capReached={typeof capReached === "string" ? capReached : null}
    />
  );
}
