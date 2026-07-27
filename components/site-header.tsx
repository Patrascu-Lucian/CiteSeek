import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Header for every route outside the landing page.
 *
 * The "back" affordance is a Link to an explicit destination rather than a
 * `history.back()` button. A history-based control does something different
 * depending on how you arrived — and does nothing at all when the page was
 * opened from a pasted link, which is exactly how an interviewer will arrive.
 * A link always goes somewhere predictable and works with middle-click,
 * open-in-new-tab, and keyboard activation for free.
 */
export function SiteHeader({
  backHref = "/",
  backLabel = "Back to home",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="border-border/60 border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-4">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>

        <span aria-hidden="true" className="text-border">
          /
        </span>

        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          CiteSeek
        </Link>
      </div>
    </header>
  );
}
