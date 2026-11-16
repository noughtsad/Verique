import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Verique', template: '%s · Verique' },
  description: 'A social app where any post can be fact-checked against live web evidence, and every verdict can be challenged.',
  keywords: ['fact-checking', 'AI', 'verification', 'trust', 'evidence'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
