import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { pageShell } from "@/components/ui/page-shell";

const Bar = ({ className }: { className: string }) => (
  <div className={`bg-muted animate-pulse rounded-md ${className}`} />
);

/** Without a boundary Next holds the *old* page on screen until the server
 * finishes, which reads as a link that did nothing. Reserves the signed-in
 * layout, not the guest's single card: telling them apart means awaiting a
 * session, and a fallback that suspends is not a fallback. */
export default function AccountLoading() {
  return (
    <main id="main" className={pageShell("2xl")} aria-busy="true">
      <p role="status" className="sr-only">
        Loading your account…
      </p>

      <Bar className="h-8 w-40" />

      {/* Your details: a face beside a two-row description list. */}
      <Card className="mt-6">
        <CardHeader>
          <Bar className="h-5 w-32" />
        </CardHeader>
        <CardContent className="flex items-start gap-4">
          <div className="bg-muted size-10 shrink-0 animate-pulse rounded-full" />
          <div className="flex-1 space-y-3">
            <Bar className="h-4 w-full max-w-sm" />
            <Bar className="h-4 w-full max-w-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Sign-in methods, then Ending your session: a title, a line of
        description, and a row of controls each. */}
      {[0, 1].map((card) => (
        <Card key={card} className="mt-6">
          <CardHeader>
            <Bar className="h-5 w-40" />
            <Bar className="mt-2 h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent>
            <Bar className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}

      {/* Delete your account, which sits further down and carries its own edge. */}
      <Card className="border-destructive/40 mt-10">
        <CardHeader>
          <Bar className="h-5 w-44" />
          <Bar className="mt-2 h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent>
          <Bar className="h-8 w-36" />
        </CardContent>
      </Card>
    </main>
  );
}
