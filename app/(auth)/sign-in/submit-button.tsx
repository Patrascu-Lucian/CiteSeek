"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** A client component because `useFormStatus` reads the enclosing form: the
 * action redirects to GitHub, and the page sat unchanged until it did. */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full"
      size="lg"
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Loader2
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin"
          />
          Taking you to GitHub…
        </>
      ) : (
        children
      )}
    </Button>
  );
}
