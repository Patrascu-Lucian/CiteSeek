import { requireWorkspace } from "@/lib/workspaces/require-workspace";

/** Renders nothing: the `notFound()` has to run above `loading.tsx`, whose
 * boundary flushes a 200 before anything under it resolves. **Not the
 * authorization boundary** — every page below repeats the check. */
export default async function WorkspaceGuard({
  params,
  children,
}: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) {
  await requireWorkspace((await params).workspaceId);

  return children;
}
