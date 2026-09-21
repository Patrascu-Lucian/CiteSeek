import Image from "next/image";
import Link from "next/link";
import { FileText, MessageSquareQuote, ShieldCheck } from "lucide-react";

import sourceLight from "@/docs/images/source.png";
import sourceDark from "@/docs/images/dark.png";

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

/** Split from `page.tsx`, which resolves the actor: that makes it async and
 * pulls in Auth.js, neither of which React Testing Library can render. */

/* Written down because under Vitest the loader returns a URL string, not the
   object next/image reads dimensions from. */
const SHOT = {
  width: 1280,
  height: 960,
  sizes: "(min-width: 1024px) 64rem, 100vw",
} as const;

/* Each figure is checked against a committed report by `landing.test.tsx`.
   Recall is at three passages, not the eight where it reads 1.00: precision
   there is 0.14. No reader counts, no zero for invented citations. */
const PROOF = [
  { value: "365 ms", label: "to the first source, deployed" },
  { value: "0.85 s", label: "to the first token of prose" },
  { value: "0.95", label: "of answers found in the top three passages" },
  { value: "86.5%", label: "of 830 mutants caught in the pure core" },
] as const;

const steps = [
  {
    title: "The question is matched against your documents",
    body: "It is embedded and compared with the passages of the files in this workspace — scoped in the SQL of the search itself, not filtered afterward.",
  },
  {
    title: "The passages are sent before the model writes",
    body: "Whatever clears the relevance floor goes to your browser first. The model then writes with numbered markers against that payload, so a marker points at a passage that already arrived.",
  },
  {
    title: "A marker opens the passage it came from",
    body: "Clicking one opens the document at the exact characters the answer was grounded in, highlighted, with its page number — the offsets are recorded when the file is chunked.",
  },
] as const;

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
        aria-labelledby="how-heading"
        className="border-border/60 border-t"
      >
        <div className={pageShell("5xl", "py-16")}>
          <h2
            id="how-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            How a question is answered
          </h2>

          <figure className="mt-8">
            {/* One view, two palettes: the same screen photographed in each, so
                the `dark:` variant swaps the file rather than showing a light
                product to a dark page. Both are written by `pnpm demo:shots`. */}
            <Image
              src={sourceLight}
              {...SHOT}
              alt="The source panel open beside a cited answer, with the cited passage highlighted and its page number shown"
              className="border-border/60 rounded-lg border dark:hidden"
            />
            <Image
              src={sourceDark}
              {...SHOT}
              alt=""
              aria-hidden="true"
              className="border-border/60 hidden rounded-lg border dark:block"
            />
            <figcaption className="text-muted-foreground mt-3 text-sm">
              The demo workspace: an answer, its numbered markers, and the
              passage one of them opens.
            </figcaption>
          </figure>

          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map(({ title, body }, index) => (
              <li key={title}>
                <p className="text-muted-foreground text-sm font-medium">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 font-medium">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="proof-heading"
        className="border-border/60 border-t"
      >
        <div className={pageShell("5xl", "py-16")}>
          <h2 id="proof-heading" className="sr-only">
            What has been measured
          </h2>
          <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PROOF.map(({ value, label }) => (
              <div key={label}>
                <dt className="text-3xl font-semibold tracking-tight tabular-nums">
                  {value}
                </dt>
                <dd className="text-muted-foreground mt-2 text-sm">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground mt-8 text-sm">
            Measured rather than asserted: the method behind each number, and
            what it does not cover, is in the{" "}
            <Link href="/about" className="hover:text-foreground underline">
              about page
            </Link>
            .
          </p>
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
