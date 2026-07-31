/**
 * The landing page reads the session to decide what to offer — a returning guest
 * is shown their demo rather than a signup — so it is server work like any other
 * route, and without a boundary here "CiteSeek" in the header holds the previous
 * page on screen while it runs.
 *
 * Cheap to add, and the one navigation every reader makes at least once.
 */
export default function MarketingLoading() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-3xl px-6 py-20"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Loading…
      </p>

      <div className="bg-muted h-10 w-full max-w-lg animate-pulse rounded-md" />
      <div className="bg-muted mt-4 h-5 w-full max-w-md animate-pulse rounded-md" />

      <div className="mt-10 flex gap-3">
        <div className="bg-muted h-11 w-36 animate-pulse rounded-lg" />
        <div className="bg-muted h-11 w-36 animate-pulse rounded-lg" />
      </div>
    </main>
  );
}
