import Link from "next/link";

import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  leaveDemoAction,
  linkProviderAction,
  signOutAction,
} from "@/lib/auth/actions";
import { pageShell } from "@/components/ui/page-shell";

/**
 * Account deletion, which used to sit in the header — an irreversible action one
 * stray click from a wordmark. Split from `page.tsx` because resolving the actor
 * makes a component async and reaches into Auth.js, neither of which RTL renders.
 */
export type AccountViewProps =
  | { kind: "guest" }
  | {
      kind: "user";
      name: string | null;
      email: string | null;
      /** Already resolved — this component does no lookups. `readonly` so a caller
       * can pass a frozen literal without a cast. */
      providers: readonly string[];
      /** The providers not linked yet, resolved by the page for the same reason. */
      linkable: readonly { id: string; label: string }[];
    };

export function AccountView(props: AccountViewProps) {
  return (
    <main id="main" className={pageShell("2xl")}>
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      {props.kind === "guest" ? <GuestNotice /> : <UserAccount {...props} />}
    </main>
  );
}

/** A guest session has no database row, so "delete my account" has no referent.
 * Said before the attempt rather than after. */
function GuestNotice() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>You are in a guest session</h2>
        </CardTitle>
        <CardDescription>
          Guest sessions store nothing on the server, so there is no account
          here to manage or delete, and conversations you have as a guest are
          never written down. Leaving the demo clears the session from this
          browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/sign-in">Sign in to keep your work</Link>
        </Button>
        {/* The exit the header gave up to offer the way in instead. Here because
          this is the page that explains what a guest session is. */}
        <form action={leaveDemoAction}>
          <Button type="submit" variant="outline">
            Leave the demo
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UserAccount({
  name,
  email,
  providers,
  linkable,
}: Extract<AccountViewProps, { kind: "user" }>) {
  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle asChild className="text-lg">
            <h2>Your details</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/*
            A description list, not a table: these are name/value pairs, and `dl`
            is what conveys that pairing to a screen reader. A table would
            announce rows and columns that do not exist.
          */}
          <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{name ?? <NotProvided />}</dd>

            <dt className="text-muted-foreground">Email</dt>
            <dd>{email ?? <NotProvided />}</dd>
          </dl>
        </CardContent>
      </Card>

      <SignInMethods providers={providers} linkable={linkable} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle asChild className="text-lg">
            <h2>Ending your session</h2>
          </CardTitle>
          <CardDescription>
            Signing out leaves everything where it is. Sign back in with any of
            the methods above and your documents and conversations will be
            waiting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      {/*
        Last, and set apart. Irreversible actions belong at the end of a page
        rather than beside the recoverable ones — the ordering is part of how a
        reader tells the two apart before reading a word.
      */}
      <Card className="border-destructive/40 mt-10">
        <CardHeader>
          <CardTitle asChild className="text-lg">
            <h2>Delete your account</h2>
          </CardTitle>
          <CardDescription>
            This removes your account and everything reachable from it: your
            workspaces, every document and its extracted text, the passages and
            embeddings built from them, and every conversation. It cannot be
            undone, and no copy is kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </>
  );
}

function SignInMethods({
  providers,
  linkable,
}: Pick<
  Extract<AccountViewProps, { kind: "user" }>,
  "providers" | "linkable"
>) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>Sign-in methods</h2>
        </CardTitle>
        <CardDescription>
          Any of these reaches the same account. Adding one from here links it
          to the session you are in, so it never depends on two services
          agreeing about your email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Signs in with</dt>
          <dd>
            {providers.length > 0 ? providers.join(", ") : <NotProvided />}
          </dd>
        </dl>

        {linkable.map(({ id, label }) => (
          <form key={id} action={linkProviderAction.bind(null, id)}>
            <Button type="submit" variant="outline">
              Add {label}
            </Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}

function NotProvided() {
  return <span className="text-muted-foreground">Not provided</span>;
}
