import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * The threat is not hostile text — the prompt delimits that — it is the renderer
 * turning model output into a network request: an image is fetched **on render,
 * with no click**, and its path carries whatever the model was persuaded to put
 * there. So images do not render and links are inert.
 */

/** Streamdown renders `**bold**` as a styled span — visually right, semantically
 * empty. axe cannot report this: a weighted span is indistinguishable from
 * decoration from the outside. Cheap to override, so no reason not to. */
export function SemanticStrong({ children }: { children?: ReactNode }) {
  return <strong className="font-semibold">{children}</strong>;
}

export function SemanticEmphasis({ children }: { children?: ReactNode }) {
  return <em className="italic">{children}</em>;
}

/** Not dropped silently — if a document legitimately references a figure, the
 * reader should see something was there. */
export function InertImage({ alt }: ComponentPropsWithoutRef<"img">) {
  const label = alt?.trim();

  return (
    <span className="text-muted-foreground text-xs italic">
      {label ? `[image: ${label}]` : "[image]"}
    </span>
  );
}

/**
 * Text plus the bare URL. Links need no fetch, so they are weaker than images —
 * but a plausible link inside an answer that appears to come from your own
 * documents is a phishing surface, and the reader cannot tell which part came
 * from a passage. Showing the destination lets them judge; not linking it means
 * no mis-click. `CitationLink` handles `#citation-*` before this.
 */
export function InertLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const destination = href?.trim();

  return (
    <span>
      {children}
      {destination ? (
        <span className="text-muted-foreground"> ({destination})</span>
      ) : null}
    </span>
  );
}
