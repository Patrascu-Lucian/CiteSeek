import Link from "next/link";
import { FileText, MessageSquareQuote, ShieldCheck } from "lucide-react";

import { HeroGraphic } from "@/components/marketing/hero-graphic";
import { Button } from "@/components/ui/button";
import { prefetchFor } from "@/lib/links";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { LandingCallsToAction } from "./calls-to-action";
import { pageShell } from "@/components/ui/page-shell";

/**
 * The landing page's markup, with no idea who is reading it.
 *
 * Split from `page.tsx` for the same reason `DocumentList` is split from
 * `DocumentsPanel`: the page resolves the actor, which makes it async and pulls
 * in Auth.js, and neither of those can be rendered by React Testing Library.
 * Presentational and stateless, this one can.
 */

const features = [
  {
    icon: FileText,
    title: "Bring your own documents",
    description:
      "Upload PDFs, Word documents, Markdown or plain text. Each file is parsed into passages that keep their page and character offsets.",
  },
  {
    icon: MessageSquareQuote,
    title: "Answers that cite their sources",
    description:
      "Every claim is backed by a numbered citation. Click one and the source document opens, scrolled to the exact passage.",
  },
  {
    icon: ShieldCheck,
    title: "A citation cannot be invented",
    description:
      "A marker that points at no retrieved passage stays plain text, and when nothing relevant is found, the reply saying so is written by CiteSeek rather than the model.",
  },
] as const;

export function Landing({ primary, secondary, note }: LandingCallsToAction) {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <section
        className={pageShell(
          "5xl",
          "relative isolate z-10 flex flex-1 flex-col justify-center py-14 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center md:gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,22rem)] lg:gap-16 lg:py-20",
        )}
      >
        {/* Negative margin because the shell constrains the content width, not
            the background. */}
        <div
          aria-hidden="true"
          className="from-primary/15 absolute inset-0 -z-10 -mx-[calc(50vw-50%)] bg-linear-to-br via-transparent to-transparent"
        />

        {/* In the sm band the graphic is out of flow beside this, and full-width
            copy would run underneath it. */}
        <div className="sm:max-w-[75%] md:max-w-none">
          <h1 className="text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
            Ask your documents. Get answers you can verify.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg text-pretty">
            CiteSeek streams answers grounded in the files you upload — and
            every sentence links back to the passage it came from, so you never
            have to take the model&apos;s word for it.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {/* Both hrefs vary by actor, and two of the four write. */}
            <Button asChild size="lg">
              {/* The cost is a sentence under the button for a sighted reader
                  and nowhere at all for one moving by links, unless it is named
                  as this one's description. */}
              <Link
                href={primary.href}
                prefetch={prefetchFor(primary.href)}
                aria-describedby={note ? "cta-note" : undefined}
              >
                {primary.label}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link
                href={secondary.href}
                prefetch={prefetchFor(secondary.href)}
              >
                {secondary.label}
              </Link>
            </Button>
          </div>

          {note && (
            <p id="cta-note" className="text-muted-foreground mt-4 text-sm">
              {note}
            </p>
          )}
        </div>

        {/* Out of flow in the sm band, beside the buttons: stacked it cost 288px
            of height there. A grid column from md. */}
        <HeroGraphic className="pointer-events-none absolute right-0 -bottom-12 hidden h-auto w-64 sm:block md:static md:w-full" />
      </section>

      <section
        aria-labelledby="features-heading"
        className="border-border/60 border-t"
      >
        <div className={pageShell("5xl", "py-16")}>
          <h2 id="features-heading" className="sr-only">
            What CiteSeek does
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title}>
                <Card className="h-full">
                  <CardHeader>
                    <Icon
                      aria-hidden="true"
                      className="text-muted-foreground size-5"
                    />
                    <CardTitle className="mt-3">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="guarantee-heading"
        className="border-border/60 border-t"
      >
        <div className={pageShell("5xl", "py-16 md:max-w-3xl")}>
          <h2
            id="guarantee-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            How that guarantee is built
          </h2>
          <div className="text-muted-foreground mt-4 space-y-4 text-base">
            <p>
              The passages are retrieved and sent to your browser before the
              model writes a word. A marker in the answer resolves against that
              payload, so it points at a passage that already existed — the
              model chooses which to cite, and cannot cite what it was not
              given.
            </p>
            <p>
              A marker that resolves to nothing stays plain text rather than
              becoming a link, so a number the model invented cannot present
              itself as a source.
            </p>
            <p>
              And when nothing retrieved is relevant enough, no answer is
              generated at all: the reply saying so is written by CiteSeek, on a
              branch where the model never runs.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="local-heading"
        className="border-border/60 border-t"
      >
        <div className={pageShell("5xl", "py-16 md:max-w-3xl")}>
          <h2
            id="local-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Or keep the documents in your browser
          </h2>
          <p className="text-muted-foreground mt-4 text-base">
            Local mode runs the model on your machine, so the text of a document
            never leaves it — the one claim here that is sovereignty rather than
            a region on a map. It is experimental, and{" "}
            {/* A plain anchor: /local needs the headers its own response
                carries, and a client navigation keeps the previous page's
                (ADR 028). */}
            <a href="/local" className="hover:text-foreground underline">
              the page says what it measures
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
