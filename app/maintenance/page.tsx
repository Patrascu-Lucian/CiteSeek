import type { Metadata } from "next";

import { Wrench } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Back shortly" };

/** No links out: every route is answering this page, so a button would land the
 * reader back here. */
export default function MaintenancePage() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-3 py-16 sm:px-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <Wrench aria-hidden="true" className="text-muted-foreground size-5" />
          <CardTitle asChild className="mt-3 text-xl">
            <h1>CiteSeek is down for maintenance</h1>
          </CardTitle>
          <CardDescription>
            A planned update is running. Nothing you uploaded is affected, and
            everything will be where you left it. Try again in a few minutes.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
