"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** A client component because `useFormStatus` reads the enclosing form: the
 * action redirects away, and the page sat unchanged until it did. */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  /** The sign-in page's one big button; the account card's sit in a row. */
  block = false,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  block?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className={block ? "w-full" : undefined}
      size={block ? "lg" : undefined}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Loader2
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
