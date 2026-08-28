import { pageShell } from "@/components/ui/page-shell";

/** Reserving only the documents half left the footer painting at ~400px and
 * moving to ~900px: CLS 0.324, a quarter of this route's Lighthouse score. The
 * conversation block is a stand-in for that height, not for the panel. */
export default function WorkspaceLoading() {
  // Read by `e2e/workspace-shell.spec.ts`: four other routes render a busy
  // `main`, so `aria-busy` cannot name this one.
  return (
    <main
      id="main"
      className={pageShell("5xl", "flex-1")}
      aria-busy="true"
      data-workspace-skeleton=""
    >
      <p role="status" className="sr-only">
        Loading workspace…
      </p>

      <div className="bg-muted h-9 w-64 animate-pulse rounded-md" />
      <div className="bg-muted mt-2 h-4 w-80 animate-pulse rounded-md" />

      <div className="mt-10">
        <div className="bg-muted h-6 w-32 animate-pulse rounded-md" />
        <div className="border-border mt-4 rounded-xl border p-6">
          <div className="bg-muted size-5 animate-pulse rounded-md" />
          <div className="bg-muted mt-3 h-5 w-48 animate-pulse rounded-md" />
          <div className="bg-muted mt-2 h-4 w-full max-w-md animate-pulse rounded-md" />
        </div>
      </div>

      <div className="mt-10">
        <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
        <div className="border-border mt-4 h-72 rounded-xl border" />
        <div className="border-border mt-3 h-12 rounded-xl border" />
      </div>
    </main>
  );
}
