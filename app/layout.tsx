import "./globals.css";
import { Viewport } from 'next';
import ClientLayout from '@/components/client-layout';
import { Inter } from 'next/font/google';

// Add KaTeX CSS - Removed as unused
// import 'katex/dist/katex.min.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Tekir is a fast, open-source, and privacy-focused search engine." />
        <link rel="icon" href="/favicon.ico" />
        <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="Tekir" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}