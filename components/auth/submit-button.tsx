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
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      className={variant ? undefined : "w-full"}
      size={variant ? undefined : "lg"}
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
