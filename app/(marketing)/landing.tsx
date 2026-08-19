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
    title: "A refusal cannot cite",
    description:
      "When retrieval finds nothing relevant, CiteSeek says so instead of inventing a citation.",
  },
] as const;

export function Landing({ primary, secondary }: LandingCallsToAction) {
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
          <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Document intelligence
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
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
              <Link href={primary.href} prefetch={prefetchFor(primary.href)}>
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
    </main>
  );
}
