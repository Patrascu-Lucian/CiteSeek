import type { Metadata } from "next";

import { Wrench } from "lucide-react";

import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = { title: "Back shortly" };

/** No links out: every route is answering this page, so a button would land the
 * reader back here. */
export default function MaintenancePage() {
  return (
    <StatusPage
      icon={Wrench}
      title="CiteSeek is down for maintenance"
      description="A planned update is running. Nothing you uploaded is affected, and everything will be where you left it. Try again in a few minutes."
    />
  );
}
