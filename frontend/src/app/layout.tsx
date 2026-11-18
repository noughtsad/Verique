import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

// Keep in sync with hooks/useTheme.ts (storage key and resolution rule).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("verique-theme");var d=matchMedia("(prefers-color-scheme: dark)").matches;var r=t==="light"||t==="dark"?t:(d?"dark":"light");var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(r);e.style.colorScheme=r}catch(_){document.documentElement.classList.add("dark")}})()`;

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
    // The inline script sets .light/.dark before first paint, so the page never flashes the
    // wrong theme; suppressHydrationWarning covers that class differing from the server HTML.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
