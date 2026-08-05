import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { REPOSITORY_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "About",
  description: "What CiteSeek is, the problem it solves, and who built it.",
};

/**
 * What a stranger on the live URL has no other way to learn.
 *
 * Everything answering "what is this and who made it" lives in the README,
 * which someone arriving at the deployed app never sees. No numbers here —
 * they belong in the README, and two copies of a measurement is one copy that
 * goes stale.
 */
export default function AboutPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">About</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        A portfolio project exploring retrieval-augmented generation with
        verifiable citations.
      </p>

      <Section title="The problem">
        <p>
          Ask a language model about your own documents and you get an answer
          that sounds right. Whether it <em>is</em> right, and which sentence in
          which file it came from, is usually left to you to work out — which
          means checking it costs about as much as not having asked.
        </p>
        <p className="mt-3">
          CiteSeek answers from documents you upload, and every claim carries a
          numbered citation. Clicking one opens the source document at the exact
          passage the answer used, highlighted in place. The point is not that
          the answer is confident; it is that you can check it in one click.
        </p>
      </Section>

      <Section title="The guarantee">
        <p>
          When nothing in your documents is relevant, the answer says so and
          cites nothing — and it cannot do otherwise. Passages are retrieved
          before the model is involved, and if none clear the relevance
          threshold <strong>the model is never called at all</strong>. There is
          no text to hallucinate a citation into, because no text is generated.
        </p>
        <p className="mt-3">
          That is the difference between a rule the system enforces and an
          instruction a model is asked to follow. Citations are resolved against
          passages the server retrieved, so a marker pointing at something that
          was not retrieved renders as plain text rather than as a link to
          nowhere.
        </p>
      </Section>

      <Section title="How it is built">
        <p>
          Next.js and TypeScript, Postgres with pgvector for search, and
          Google&rsquo;s Gemini for embeddings and generation. Everything runs
          in the EU, and the{" "}
          <Link href="/privacy" className="underline">
            privacy page
          </Link>{" "}
          says exactly what is stored and who else sees it.
        </p>
        <p className="mt-3">
          The code is public, along with the reasoning: architectural decisions
          are recorded as they were made, including the ones that turned out to
          be wrong.
        </p>
      </Section>

      <Section title="Who built it">
        <p>
          Lucian Patrascu, a senior frontend engineer, as a way of learning the
          parts of this stack that are not frontend — retrieval, embeddings,
          database design, and the operational side of running it.
        </p>
        <p className="mt-3">
          It is a portfolio project rather than a company. Nothing is sold, and
          nothing about it is a commitment.
        </p>
      </Section>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href="/" className="underline">
          Try the demo
        </Link>
        <a
          href={REPOSITORY_URL}
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Read the source
        </a>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}
