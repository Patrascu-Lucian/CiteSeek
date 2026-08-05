/**
 * Streamed while the usage query runs, so the click commits immediately and the
 * layout is reserved before the numbers arrive — the same reason every other
 * page route here has a boundary.
 */
export default function UsageLoading() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Loading usage…
      </p>

      <div className="bg-muted h-8 w-32 animate-pulse rounded-md" />
      <div className="bg-muted mt-2 h-4 w-full max-w-lg animate-pulse rounded-md" />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-border rounded-lg border p-4">
            <div className="bg-muted h-4 w-24 animate-pulse rounded-md" />
            <div className="bg-muted mt-2 h-7 w-16 animate-pulse rounded-md" />
          </div>
        ))}
      </div>

      <div className="mt-10 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-muted h-8 w-full animate-pulse rounded-md"
          />
        ))}
      </div>
    </main>
  );
}
