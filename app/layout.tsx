import "./globals.css";
import { Viewport } from 'next';
import ClientLayout from '@/components/client-layout';

// Add KaTeX CSS
import 'katex/dist/katex.min.css';

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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script defer src="https://improve.tekir.co/script.js" data-website-id="7a88a1bd-75b7-4690-abf1-b63922b3deb2"></script>
        <meta name="takeads-platform-verification" content="05503d4f-cba9-4392-ab29-73bfd6e8f1f5"></meta>
      </head>
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}