import "./globals.css";
import { Viewport } from 'next';
import ClientLayout from '@/components/client-layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { Inter } from 'next/font/google';
import Script from "next/script";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', 
  preload: true, 
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' }
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Tekir is a fast, open-source, and privacy-focused search engine." />

        {/* Content Security Policy - strict in production, permissive in development for debugging tools */}
        {process.env.NODE_ENV === "development" ? (
          <meta httpEquiv="Content-Security-Policy" content="
            default-src 'self' 'unsafe-inline' 'unsafe-eval' *.unpkg.com;
            script-src 'self' 'unsafe-inline' 'unsafe-eval' *.unpkg.com;
            style-src 'self' 'unsafe-inline';
          " />
        ) : (
          <meta httpEquiv="Content-Security-Policy" content="
            default-src 'self';
            script-src 'self' 'unsafe-inline';
            style-src 'self' 'unsafe-inline';
            img-src 'self' data: https: blob:;
            font-src 'self' data:;
            connect-src 'self' https: wss: blob:;
          " />
        )}
        <link rel="icon" href="/favicon.ico" />
        <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="Tekir" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Preconnect to external origins for faster resource loading */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tekir.co" />

        {/* Preload critical resources */}
        <link rel="preload" href="/favicon.ico" as="image" type="image/x-icon" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ErrorBoundary>
      </body>
    </html>
  );
}