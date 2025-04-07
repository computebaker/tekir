"use client";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { useEffect } from 'react';
import { prefetchBangs } from '@/utils/bangs';
import { Metadata } from 'next';

// Add KaTeX CSS
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' }
  ],
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch bangs when the app initializes
  useEffect(() => {
    prefetchBangs();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Tekir is a fast, open-source, and privacy-focused search engine." />
        <link rel="icon" href="/favicon.ico" />
        <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="Tekir" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}