"use client";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { useEffect } from 'react';
import { prefetchBangs } from '@/utils/bangs';

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
        <title>Tekir - The Capable Search Engine for the Modern Web</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Tekir is a fast, open-source, and privacy-focused search engine." />
        <link rel="icon" href="/favicon.ico" />
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