import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkspaceUsage } from "@/lib/usage/dashboard";

/**
 * Split from `page.tsx` so every state is a prop and none needs a database.
 *
 * **Tokens, never money.** The free tier costs nothing, so a figure from the paid
 * price list would describe a tier this app is not on — a plausible number nobody
 * measured. A cost column would have to name the rate it assumes.
 */
export function UsageView({
  workspaceId,
  usage,
  canUpload,
}: {
  workspaceId: string;
  usage: WorkspaceUsage;
  /** A read-only workspace cannot generate usage, which changes the empty state. */
  canUpload: boolean;
}) {
  const { days, totals, lastRecordedAt, windowDays } = usage;
  const busiest = Math.max(1, ...days.map((day) => day.requests));

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Provider calls made from this workspace over the last {windowDays}{" "}
          days. The window matches how long usage rows are kept — older ones are
          deleted, so a longer range would show zeroes rather than history.
        </p>
      </header>

      {days.length === 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-lg">
              <h2>Nothing recorded yet</h2>
            </CardTitle>
            <CardDescription>
              {canUpload
                ? "Asking a question or uploading a document spends provider calls, and they will be counted here."
                : "This workspace is read-only, so nothing you do here is charged to it."}
            </CardDescription>
          </CardHeader>
          {canUpload ? (
            <CardContent>
              <Button asChild variant="outline">
                <Link href={`/w/${workspaceId}`}>Back to the workspace</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <>
          <section aria-labelledby="totals-heading" className="mt-8">
            <h2 id="totals-heading" className="sr-only">
              Totals
            </h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Total label="Provider calls" value={totals.requests} />
              <Total label="Input tokens" value={totals.inputTokens} />
              <Total label="Output tokens" value={totals.outputTokens} />
            </dl>
          </section>

          <section aria-labelledby="by-day-heading" className="mt-10">
            <h2 id="by-day-heading" className="text-lg font-medium">
              By day
            </h2>
            {/*
              A table, because this is tabular. The bar in each row is a
              decoration on top of the number it duplicates — `aria-hidden`, so a
              screen reader hears the figure once rather than twice.
            */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Provider calls and tokens per day, newest first. Days are UTC.
                </caption>
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-left">
                    <th scope="col" className="py-2 font-medium">
                      Day (UTC)
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Calls
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      In
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Out
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.day} className="border-border/60 border-b">
                      <th
                        scope="row"
                        className="py-2 font-normal whitespace-nowrap"
                      >
                        <span className="flex items-center gap-2">
                          {day.day}
                          <span
                            aria-hidden="true"
                            className="bg-primary/20 hidden h-1.5 rounded-full sm:block"
                            style={{
                              width: `${Math.round((day.requests / busiest) * 100)}px`,
                            }}
                          />
                        </span>
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {day.requests}
                      </td>
                      <td className="text-muted-foreground py-2 text-right tabular-nums">
                        {day.inputTokens.toLocaleString("en")}
                      </td>
                      <td className="text-muted-foreground py-2 text-right tabular-nums">
                        {day.outputTokens.toLocaleString("en")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <LastRecorded at={lastRecordedAt} />
    </main>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">
        {value.toLocaleString("en")}
      </dd>
    </div>
  );
}

/**
 * The one number here about the system rather than the reader. `recordUsage`
 * swallows its failures deliberately, so if recording stops the caps silently
 * stop applying and nothing raises. A date that stops moving while the app is in
 * use is the only signal.
 */
function LastRecorded({ at }: { at: Date | null }) {
  return (
    <p className="text-muted-foreground mt-10 text-sm">
      {at ? (
        <>
          Last recorded{" "}
          <time dateTime={at.toISOString()}>
            {at.toISOString().replace("T", " ").slice(0, 16)} UTC
          </time>
          . If this stops moving while the app is being used, usage is not being
          written down — and the limits that depend on it are not applying.
        </>
      ) : (
        "Nothing has been recorded for this workspace yet."
      )}
    </p>
  );
}
