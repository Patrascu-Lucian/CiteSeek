import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { signIn } from "@/auth";
import { getActor } from "@/lib/auth/actor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a different sign-in method.",
  AccessDenied: "Sign-in was cancelled or access was denied.",
  Configuration:
    "Sign-in is not configured correctly. This is a problem on our side.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const actor = await getActor();
  if (actor?.type === "user") redirect("/");

  const { error, callbackUrl } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Something went wrong signing you in.")
    : null;

  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle asChild className="text-xl">
            <h1>Sign in to CiteSeek</h1>
          </CardTitle>
          <CardDescription>
            Upload your own documents and keep your chat history.
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

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: callbackUrl ?? "/" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Continue with GitHub
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col items-start gap-2">
          <p className="text-muted-foreground text-sm">
            Just looking around?{" "}
            <Link
              href="/demo"
              className="text-foreground underline underline-offset-4"
            >
              Try the demo
            </Link>{" "}
            — no account needed.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
