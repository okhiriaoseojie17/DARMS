import type { Metadata } from 'next';
import { Source_Serif_4, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const displayFont = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
});
const bodyFont = Inter({ subsets: ['latin'], variable: '--font-body' });
const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'DARMS — CIS Department Archive',
  description:
    'The academic resource archive for the Computer and Information Sciences Department, Covenant University.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
