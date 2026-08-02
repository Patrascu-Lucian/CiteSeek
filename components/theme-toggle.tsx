import { Monitor, Moon, Sun } from "lucide-react";

import { setThemeAction } from "@/lib/theme/actions";
import { type Theme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const satisfies readonly { value: Theme; label: string; Icon: unknown }[];

/**
 * Choosing a palette.
 *
 * A form of three submit buttons rather than a client component toggling a
 * class. The class has to be right on the *first byte* of the next response, and
 * only the server can put it there — a client-side toggle would be correct for
 * the current page and flash on the next one. The side effect is that this keeps
 * working with JavaScript disabled: the form posts, the cookie is set, the page
 * returns in the new palette.
 *
 * `aria-pressed` rather than a radio group. These are buttons that *do*
 * something on activation, not fields collecting a value to submit later — and
 * a radio group with no submit button is a form a keyboard user can change
 * without applying, which is the worse of the two shapes here.
 *
 * "System" is a choice, not the absence of one: it means "keep following the
 * operating system", including when that flips at sunset.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  return (
    <form action={setThemeAction} className="flex items-center gap-1">
      {/* Named, because three unlabelled icon buttons in a row are three
          mysteries to anyone not reading the icons. */}
      <span id="theme-label" className="sr-only">
        Color theme
      </span>

      <div
        role="group"
        aria-labelledby="theme-label"
        className="border-border flex items-center gap-0.5 rounded-md border p-0.5"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const isCurrent = value === current;

          return (
            <button
              key={value}
              type="submit"
              name="theme"
              value={value}
              aria-pressed={isCurrent}
              aria-label={label}
              title={label}
              className={cn(
                "focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isCurrent
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
            </button>
          );
        })}
      </div>
    </form>
  );
}
