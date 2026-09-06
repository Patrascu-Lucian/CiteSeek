import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Check your email" };

/** Never names the address: with no session it could only come from the
 * querystring, which reflects whatever a crafted URL supplied. */
export default function CheckYourEmailPage() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-3 py-16 sm:px-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle asChild className="text-xl">
            <h1>Check your email</h1>
          </CardTitle>
          <CardDescription>
            A sign-in link is on its way to the address you entered.
          </CardDescription>
        </CardHeader>

        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <p>
            The link works once and expires in 15 minutes. If it does not
            arrive, check the spam folder — then{" "}
            <Link
              href="/sign-in"
              className="text-foreground underline underline-offset-4"
            >
              request another
            </Link>
            .
          </p>
          {/* Says nothing happened rather than nothing was sent: an address with
              no account still gets a link, and saying otherwise here would tell
              a stranger which addresses are registered. */}
          <p>You can close this tab. Nothing else is waiting on it.</p>
        </CardContent>
      </Card>
    </main>
  );
}
