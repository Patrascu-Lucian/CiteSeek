/**
 * Streamed while the workspace query runs. A skeleton rather than a spinner:
 * it reserves the real layout, so nothing jumps when content arrives.
 *
 * aria-busy plus a polite status message means a screen-reader user is told the
 * page is loading instead of hearing silence.
 */
export default function WorkspaceLoading() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-5xl flex-1 px-6 py-12"
      aria-busy="true"
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
    </main>
  );
}
