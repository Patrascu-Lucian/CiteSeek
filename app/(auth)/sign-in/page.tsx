import Link from "next/link";
import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { signIn } from "@/auth";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { AUTH_PROVIDERS } from "@/lib/auth/providers";
import { getActor } from "@/lib/auth/actor";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

/** A reader with a session did not come here to sign in — they came from
 * "Add a method" on `/account` — so the same code means something else. */
const LINKING_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That account is already connected to a different CiteSeek account, so it was not added. Your existing sign-in methods are unchanged.",
  OAuthCallbackError:
    "That was cancelled, so nothing was added. Your existing sign-in methods are unchanged.",
};

/* `OAuthCallbackError`, not `AccessDenied`: the latter is thrown only when the
   app's own `signIn` callback refuses, and this app defines no callbacks. */
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a different sign-in method. Sign in the way you did before, then add this one from your account page.",
  OAuthCallbackError:
    "Sign-in was cancelled, or the provider turned it down. Nothing changed.",
  Configuration:
    "Sign-in is not configured correctly. This is a problem on our side.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const actor = await getActor();
  const { error, callbackUrl } = await searchParams;
  const signedIn = actor?.type === "user";

  // Not "/": the landing CTA points here, so that looped. Not on an error
  // either: a failed link arrives signed in, and redirecting swallowed it.
  if (signedIn && !error) redirect("/w");

  // `Object.hasOwn`, because `error` is attacker-supplied: a plain lookup of
  // `__proto__` or `toString` returns something `??` does not treat as absent,
  // and React throws on a non-string child.
  const said = (map: Record<string, string>) =>
    Object.hasOwn(map, error ?? "") ? map[error!] : undefined;

  const errorMessage = !error
    ? null
    : ((signedIn ? said(LINKING_MESSAGES) : undefined) ??
      said(ERROR_MESSAGES) ??
      "Something went wrong signing you in.");

  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-3 py-16 sm:px-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          {/* The `h1` is this page's accessible name, and a reader who arrives
              signed in did not come here to sign in. */}
          <CardTitle asChild className="text-xl">
            <h1>
              {signedIn ? "Adding a sign-in method" : "Sign in to CiteSeek"}
            </h1>
          </CardTitle>
          <CardDescription>
            {signedIn
              ? "This did not change how you sign in today."
              : "Upload your own documents and keep your chat history."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage ? (
            // role=alert so the failure is announced, not just recolored.
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>{errorMessage}</p>
            </div>
          ) : null}

          {/* Signed in, so the failure was a link and not a sign-in. */}
          {signedIn ? (
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href="/account">Back to your account</Link>
            </Button>
          ) : (
            AUTH_PROVIDERS.map(({ id, label }) => (
              // One form each: `useFormStatus` reports the enclosing form, so a
              // shared form would spin both buttons on either click.
              <form
                key={id}
                action={async () => {
                  "use server";
                  await signIn(id, { redirectTo: callbackUrl ?? "/w" });
                }}
              >
                <SubmitButton block pendingLabel={`Taking you to ${label}…`}>
                  Continue with {label}
                </SubmitButton>
              </form>
            ))
          )}
        </CardContent>

        {signedIn ? null : (
          <CardFooter className="flex-col items-start gap-2">
            <p className="text-muted-foreground text-sm">
              Just looking around?{" "}
              <Link
                href="/demo"
                prefetch={false}
                className="text-foreground underline underline-offset-4"
              >
                Try the demo
              </Link>{" "}
              — no account needed.
            </p>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
