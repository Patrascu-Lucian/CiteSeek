import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "What CiteSeek is, what it does not promise, and the limits it enforces.",
};

/**
 * The terms, kept to what is true.
 *
 * A portfolio project that accepts third-party uploads still needs to say what
 * it is and is not promising — but it should not borrow a SaaS template full of
 * clauses about billing, SLAs and arbitration that describe a company that does
 * not exist. Everything here is either enforced in code or is a limitation the
 * README already admits to.
 */
export default function TermsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Terms of Service
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated 5 August 2026.
      </p>

      <Section title="What this is">
        <p>
          CiteSeek is a personal project, offered free and without warranty. It
          is not a company, there is no subscription, and there is no service
          level of any kind. It may change, break, or be switched off without
          notice.
        </p>
      </Section>

      <Section title="What you may upload">
        <p>
          Documents you own or are entitled to process.{" "}
          <strong>
            Do not upload confidential material, personal data about other
            people, or anything you would mind a third-party model provider
            receiving
          </strong>{" "}
          — the{" "}
          <Link href="/privacy" className="underline">
            privacy page
          </Link>{" "}
          explains where document text goes and why that warning is there.
        </p>
      </Section>

      <Section title="Your documents stay yours">
        <p>
          Uploading something here gives this project no ownership of it. The
          only rights taken are the ones needed to do what you can watch it do:
          store the text extracted from your file, split and index that text,
          and send the passages relevant to your question to the model provider
          that writes the answer. Nothing is used to train or improve anything
          under this project&rsquo;s control, and nothing is sold or shared
          beyond the processors named on the{" "}
          <Link href="/privacy" className="underline">
            privacy page
          </Link>
          .
        </p>
        <p className="mt-3">
          What the model provider may do with what reaches it is a separate
          question, and the honest answer is on that page rather than this one.
        </p>
      </Section>

      <Section title="Limits">
        <p>
          Usage is capped per person and globally, because the underlying model
          quota is finite and shared. Reaching a limit produces a clear message
          rather than a failure, and the caps exist to keep the demo working for
          everyone rather than to upsell anything. Guests are limited more
          tightly than signed-in users.
        </p>
      </Section>

      <Section title="Answers are not advice">
        <p>
          Every answer is generated from passages retrieved out of your own
          documents, and every claim carries a citation you can open and read.
          That makes answers <em>checkable</em>, not correct. A language model
          can misread a passage it cites accurately. Check the source before
          relying on anything that matters — the citation exists precisely so
          that you can.
        </p>
      </Section>

      <Section title="The demo workspace">
        <p>
          The demo is shared, read-only, and seeded with a fictional company
          handbook. Nothing you ask there is stored. Do not treat it as private
          space.
        </p>
      </Section>

      <Section title="Ending it">
        <p>
          You can delete your account and everything in it at any time from the{" "}
          <Link href="/account" className="underline">
            account page
          </Link>
          . No confirmation email, no waiting period, no recovery.
        </p>
      </Section>
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
