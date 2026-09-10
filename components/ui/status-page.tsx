import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** No hooks, deliberately: `app/error.tsx` is a client component and renders
 * this. Unlike `pageShell`, it only ever wraps `<main>`, so it can be a
 * component rather than a class string. */
export function StatusPage({
  icon: Icon,
  title,
  description,
  contentClassName,
  children,
}: {
  icon: LucideIcon;
  /** An `h1`: these are whole pages, not sections of one. */
  title: ReactNode;
  description: ReactNode;
  /** Replaces the default row of links — `space-y-4` for the two boundaries
   * that stack an alert, a button and a digest. Not merged with it: `space-y`
   * on a flex row does nothing. */
  contentClassName?: string;
  children?: ReactNode;
}) {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-3 py-16 sm:px-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <Icon aria-hidden="true" className="text-muted-foreground size-5" />
          <CardTitle asChild className="mt-3 text-xl">
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        {children ? (
          <CardContent className={contentClassName ?? "flex flex-wrap gap-3"}>
            {children}
          </CardContent>
        ) : null}
      </Card>
    </main>
  );
}
