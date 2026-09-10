import { User } from "lucide-react";

import { cn } from "@/lib/utils";

/** Not Radix's `Avatar`, which exists to fall back when an image fails to load.
 * There is no image: `img-src 'self' data:` forbids fetching the provider URL
 * `users.image` holds. One token pair rather than a color hashed per user, which
 * would want eight contrast proofs across two themes; `--secondary` measures
 * 16.4:1 light, 14.5:1 dark. */
export function Avatar({
  name,
  email,
  className,
}: {
  name: string | null;
  email: string | null;
  className?: string;
}) {
  const initials = initialsOf(name, email);

  return (
    // The name it abbreviates is always rendered beside it.
    <span
      aria-hidden="true"
      className={cn(
        "bg-secondary text-secondary-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium select-none",
        className,
      )}
    >
      {initials || <User className="size-5" />}
    </span>
  );
}

/** The local part when there is no name: an email-link reader gave us only an
 * address. Split on its separators, so `ada.lovelace@…` yields two initials. */
function initialsOf(name: string | null, email: string | null): string {
  // Everything from a plus is a tag the reader chose, not part of who they are.
  const local = email?.split("@")[0]?.split("+")[0];
  const source = name?.trim() || local?.trim() || "";
  const words = source.split(/[\s._-]+/).filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => [...word][0] ?? "")
    .join("")
    .toUpperCase();
}
