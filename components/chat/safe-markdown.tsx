import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * What an answer is allowed to render.
 *
 * The threat is not that a document contains hostile text — retrieval is
 * supposed to surface document text, and the system prompt already delimits it.
 * The threat is that the *renderer* turns model output into a network request.
 *
 * An attacker who can get text into a workspace (a shared document, a file
 * someone was sent) can try to make the model emit Markdown of their choosing.
 * If that Markdown renders as an image, the browser fetches the URL **on render,
 * with no click**, and the path can carry whatever the model was persuaded to
 * put in it. That is an exfiltration channel out of a document the attacker
 * cannot otherwise read, and it costs the reader nothing to trigger because
 * looking at the answer is the whole interaction.
 *
 * So images do not render, and links are inert. Neither is a guess about what
 * the model will do; both remove the capability.
 */

/**
 * An image becomes its alt text.
 *
 * Not dropped silently: if a document legitimately references a figure, the
 * reader should see that something was there. The alt text is the model's own
 * words and renders as text like any other.
 */
export function InertImage({ alt }: ComponentPropsWithoutRef<"img">) {
  const label = alt?.trim();

  return (
    <span className="text-muted-foreground text-xs italic">
      {label ? `[image: ${label}]` : "[image]"}
    </span>
  );
}

/**
 * A non-citation link renders as text plus its bare URL.
 *
 * Links need no fetch on render, so they are a weaker channel than images — but
 * a plausible-looking link in an answer that appears to come from your own
 * documents is a good phishing surface, and the reader has no way to tell which
 * part of the answer came from a passage and which from an instruction inside
 * one. Showing the destination inline lets them judge it; not linking it means a
 * mis-click cannot happen.
 *
 * Citation markers never reach here — `CitationLink` handles the `#citation-*`
 * hrefs first and this is its fallback.
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
