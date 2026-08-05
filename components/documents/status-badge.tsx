import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/db/schema";

/**
 * Status as a word, not a color.
 *
 * Color alone fails for colorblind users and disappears in high-contrast modes,
 * so every state is labeled in text and the color only reinforces it.
 */
const LABELS: Record<DocumentStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export function StatusBadge({
  status,
  embedded,
  total,
}: {
  status: DocumentStatus;
  embedded?: number;
  total?: number | null;
}) {
  // While processing, the badge carries progress. "Processing" alone gives no
  // sense of whether a large document is moving or stuck.
  const label =
    status === "processing" && total
      ? `Processing ${embedded ?? 0}/${total}`
      : LABELS[status];

  return (
    <Badge
      // Tighter on a phone, where every horizontal pixel is filename.
      className="px-1.5 sm:px-2"
      variant={
        status === "failed"
          ? "destructive"
          : status === "ready"
            ? "success"
            : "secondary"
      }
    >
      {/* Only `ready` narrows — `processing` carries a count, and without it a
          stuck document looks like a moving one. `sr-only` rather than `hidden`,
          or the list's `aria-live` announces a finished upload as nothing. */}
      {status === "ready" ? (
        <>
          <Check aria-hidden="true" className="size-3.5 sm:hidden" />
          <span className="sr-only sm:not-sr-only">{label}</span>
        </>
      ) : (
        label
      )}
    </Badge>
  );
}
