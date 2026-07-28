import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CiteSeek — ask your documents, get cited answers",
    template: "%s · CiteSeek",
  },
  description:
    "Upload documents and ask questions. Answers stream back with clickable citations that open the exact source passage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
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
      </body>
    </html>
  );
}
