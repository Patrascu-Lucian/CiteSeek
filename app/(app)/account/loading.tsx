import { pageShell } from "@/components/ui/page-shell";

/**
 * Without a loading boundary Next holds the *old* page on screen until the server
 * finishes, which reads as a link that did nothing. A skeleton rather than a
 * spinner: it reserves the real layout, so nothing jumps on arrival.
 */
export default function AccountLoading() {
  return (
    <main id="main" className={pageShell("2xl")} aria-busy="true">
      <p role="status" className="sr-only">
        Loading your account…
      </p>

      <div className="bg-muted h-8 w-40 animate-pulse rounded-md" />

      <div className="border-border mt-6 rounded-xl border p-6">
        <div className="bg-muted h-5 w-32 animate-pulse rounded-md" />
        <div className="mt-6 space-y-3">
          <div className="bg-muted h-4 w-full max-w-sm animate-pulse rounded-md" />
          <div className="bg-muted h-4 w-full max-w-xs animate-pulse rounded-md" />
          <div className="bg-muted h-4 w-full max-w-[16rem] animate-pulse rounded-md" />
        </div>
      </div>

      <div className="border-border mt-6 rounded-xl border p-6">
        <div className="bg-muted h-5 w-40 animate-pulse rounded-md" />
        <div className="bg-muted mt-3 h-4 w-full max-w-md animate-pulse rounded-md" />
      </div>
    </main>
  );
}
