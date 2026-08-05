import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
