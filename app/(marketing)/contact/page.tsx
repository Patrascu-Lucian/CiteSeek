import type { Metadata } from "next";
import Link from "next/link";

import { pageShell } from "@/components/ui/page-shell";
import { REPOSITORY_URL } from "@/lib/links";

export const metadata: Metadata = { title: "Contact" };

/** One route the policy can name, so the address it eventually carries is a
 * change here rather than on every page that promises one. */
export default function ContactPage() {
  return (
    <main id="main" className={pageShell("2xl")}>
      <h1 className="text-2xl font-semibold tracking-tight">Contact</h1>

      <div className="text-muted-foreground mt-6 space-y-6 text-sm leading-relaxed">
        <p>
          This is a portfolio project rather than a company, so there is no
          support desk. What follows is every way to reach it or to act without
          reaching it.
        </p>

        <section>
          <h2 className="text-foreground text-lg font-medium">
            Deleting your data
          </h2>
          <p className="mt-2">
            You do not have to ask. The{" "}
            <Link href="/account" className="underline">
              account page
            </Link>{" "}
            deletes your account and everything reachable from it — workspaces,
            documents, the text and passages extracted from them, and every
            conversation. It happens immediately and no copy is kept.
          </p>
          <p className="mt-2">
            Documents held in your browser by{" "}
            <Link href="/local" className="underline" prefetch={false}>
              local mode
            </Link>{" "}
            never reached a server, so no request here can remove them. Clear
            them from that page.
          </p>
        </section>

        <section>
          <h2 className="text-foreground text-lg font-medium">
            Questions, and anything deletion does not cover
          </h2>
          <p className="mt-2">
            Open an issue on{" "}
            <a
              href={REPOSITORY_URL}
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              the repository
            </a>
            . It is public, so write nothing there you would not publish — for
            anything that has to stay private, say so in the issue and a route
            will be arranged.
          </p>
        </section>

        <section>
          <h2 className="text-foreground text-lg font-medium">
            What this project will never send you
          </h2>
          <p className="mt-2">
            The only email it sends is a sign-in link, and only when somebody
            asks for one. There is no newsletter, no product mail, and no
            address list.
          </p>
        </section>
      </div>
    </main>
  );
}
