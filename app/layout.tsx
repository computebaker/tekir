import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tekir',
  description: 'Privacy-first, AI-enhanced search engine',
  icons: '/favicon.ico',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div id="global-tag">
          <script defer src="https://telemetry.tekir.co/script.js" data-website-id="71b0a4f4-071d-4e5f-a39f-203dbfa92d5c"></script>
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}