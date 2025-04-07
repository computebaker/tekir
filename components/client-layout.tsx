"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { useEffect } from 'react';
import { prefetchBangs } from '@/utils/bangs';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch bangs when the app initializes
  useEffect(() => {
    prefetchBangs();
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
