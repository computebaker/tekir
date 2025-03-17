"use client";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { useEffect } from 'react';
import { prefetchBangs } from '@/utils/bangs';

// Add KaTeX CSS
import 'katex/dist/katex.min.css';

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
        {/* Remove the static title as we'll set it dynamically */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Tekir is a fast, open-source, and privacy-focused search engine." />
        <link rel="icon" href="/favicon.ico" />
        <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="Tekir" />

        <script defer src="https://telemetry.tekir.co/script.js" data-website-id="71b0a4f4-071d-4e5f-a39f-203dbfa92d5c"></script>
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