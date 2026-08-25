import type { ReactNode } from "react";
import type { Metadata } from "next";

import { siteUrl } from "@/lib/site-url";
import { cookies } from "next/headers";
import { Audiowide, Geist, Geist_Mono } from "next/font/google";

import { NavigationProgress } from "@/components/navigation-progress";
import { SiteFooter } from "@/components/site-footer";
import { THEME_COOKIE_NAME, isTheme, themeClass } from "@/lib/theme/theme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The wordmark only; a display face at body sizes is unreadable.
 *
 * `next/font` self-hosts at build time. Beyond the round trip, a CDN link would
 * put every reader's IP in front of Google unasked — unlawful in the EU since
 * the 2022 Munich ruling.
 */
const audiowide = Audiowide({
  // Named for the face, not the role: `--font-wordmark` in globals.css points
  // here, and a key pointing at itself resolves to nothing (see the note there).
  variable: "--font-audiowide",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  /* Without this a relative `opengraph-image` stays relative, the crawler
     resolves nothing, and the card renders bare with nothing failing. */
  metadataBase: siteUrl(),
  title: {
    default: "CiteSeek — ask your documents, get cited answers",
    template: "%s · CiteSeek",
  },
  description:
    "Upload documents and ask questions. Answers stream back with clickable citations that open the exact source passage.",
  openGraph: {
    title: "CiteSeek — ask your documents, get cited answers",
    description:
      "Upload documents and ask questions. Answers stream back with clickable citations that open the exact source passage.",
    siteName: "CiteSeek",
    type: "website",
    // `language_TERRITORY`, which is the format Open Graph specifies; a bare
    // `en` is flagged by Facebook's sharing debugger.
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "CiteSeek — ask your documents, get cited answers",
    description:
      "Upload documents and ask questions. Answers stream back with clickable citations that open the exact source passage.",
  },
};

/**
 * The palette is right on the first byte, which is the whole reason the choice is
 * a cookie (ADR 018): `localStorage` is invisible to the server, so the usual
 * version paints the wrong palette and corrects it with a blocking inline script.
 * No cookie means no class, leaving `prefers-color-scheme` to decide.
 */
async function themeClassName(): Promise<string> {
  const stored = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  return isTheme(stored) ? themeClass(stored) : "";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const theme = await themeClassName();

  return (
    <html
      lang="en"
      // Filtered rather than interpolated: `theme` is empty for a reader who
      // has expressed no preference, and a template literal would leave a double
      // space in the attribute on every page in the app.
      className={[
        geistSans.variable,
        geistMono.variable,
        audiowide.variable,
        theme,
        "h-full antialiased",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <NavigationProgress />
        {/*
          Skip link: the chat surface will be a long, streaming region, so a
          keyboard user must be able to jump past the nav. Accessibility starts
          here rather than being retrofitted in Milestone 3.
        */}
        <a
          href="#main"
          className="focus:bg-background focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:ring-2"
        >
          Skip to main content
        </a>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
