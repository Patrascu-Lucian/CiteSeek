import { SiteHeader } from "@/components/site-header";

/**
 * The landing page gets the same header as everywhere else.
 *
 * Without it, a signed-in visitor arriving at `/` saw no sign they were signed
 * in and had no route to their workspace — the header is where identity and the
 * session exit live, and it was the one page that hid them.
 *
 * `showBack={false}` because "back to home" on the home page points at itself.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader showBack={false} />
      {children}
    </>
  );
}
