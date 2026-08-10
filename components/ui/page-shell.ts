import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The page gutter: centered, full width, and the horizontal padding every route
 * repeats. Returns classes rather than wrapping a component, because the element
 * carrying it is a semantic choice — `main`, `section`, `footer` and `div` are all
 * correct somewhere here, and an `as` prop would bury which one a route picked.
 */
const shell = cva("mx-auto w-full px-3 py-12 sm:px-6", {
  variants: {
    width: {
      "2xl": "max-w-2xl",
      "3xl": "max-w-3xl",
      "5xl": "max-w-5xl",
    },
  },
});

export type PageShellWidth = NonNullable<VariantProps<typeof shell>["width"]>;

/** `py-12` is the default because eight of the twelve call sites want it; the rest
 * pass their own and `cn` resolves the conflict in favor of the caller. */
export function pageShell(width: PageShellWidth, className?: string) {
  return cn(shell({ width }), className);
}
