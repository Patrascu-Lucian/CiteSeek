import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { listChats } from "@/lib/chats/queries";
import { listDocuments } from "@/lib/documents/queries";
import { capRefusalCopy } from "@/lib/limits/caps";
import { resolvePlanLimits } from "@/lib/limits/config";
import { pageShell } from "@/components/ui/page-shell";
import { requireWorkspace } from "@/lib/workspaces/require-workspace";

/** The workspace rather than the conversation. A layout, so switching
 * conversations reconciles instead of remounting (ADR 041). */
export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) {
  const { workspaceId } = await params;
  const { workspace, writable, signedIn, userId } =
    await requireWorkspace(workspaceId);

  const [documents, chats] = await Promise.all([
    listDocuments(workspace.id),
    writable && userId ? listChats(workspace.id, userId) : [],
  ]);

  const limits = resolvePlanLimits();

  // The copy, not the decision to show it: that is on the URL, which a layout
  // cannot read, so the shell gates it.
  const conversationCap =
    chats.length >= limits.conversations
      ? capRefusalCopy({
          allowed: false,
          reason: "cap_reached",
          cap: "conversations",
          limit: limits.conversations,
          current: chats.length,
        })
      : null;

  return (
    <main id="main" className={pageShell("5xl", "flex-1")}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {workspace.isDemo
              ? "A shared workspace for trying CiteSeek out."
              : "Your documents and chats live here."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {workspace.isDemo ? (
            <span className="border-border text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium">
              Read-only demo
            </span>
          ) : null}
        </div>
      </header>

      <WorkspaceShell
        workspaceId={workspace.id}
        initialDocuments={documents}
        chats={chats}
        canWrite={writable}
        signedIn={signedIn}
        conversationCap={conversationCap}
      >
        {children}
      </WorkspaceShell>
    </main>
  );
}
