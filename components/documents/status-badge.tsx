import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/db/schema";

/**
 * Status as a word, not a color.
 *
 * Color alone fails for colorblind users and disappears in high-contrast modes,
 * so every state is labelled in text and the color only reinforces it.
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
      variant={
        status === "failed"
          ? "destructive"
          : status === "ready"
            ? "default"
            : "secondary"
      }
    >
      {label}
    </Badge>
  );
}
