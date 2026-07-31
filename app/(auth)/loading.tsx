/**
 * Covers `/sign-in` and `/demo-unavailable`.
 *
 * One boundary for the group rather than one per route: both are a card on an
 * otherwise empty page, so the same skeleton fits, and a boundary that has to be
 * remembered per route is a boundary that gets forgotten on the next one.
 *
 * `/sign-in` reads the session to decide whether to redirect an
 * already-signed-in visitor, so it is server work like every other route here.
 */
export default function AuthLoading() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-6 py-16"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Loading…
      </p>

      <div className="border-border w-full max-w-md rounded-xl border p-6">
        <div className="bg-muted size-5 animate-pulse rounded-md" />
        <div className="bg-muted mt-3 h-6 w-48 animate-pulse rounded-md" />
        <div className="bg-muted mt-3 h-4 w-full max-w-sm animate-pulse rounded-md" />
        <div className="bg-muted mt-6 h-10 w-full animate-pulse rounded-lg" />
      </div>
    </main>
  );
}
