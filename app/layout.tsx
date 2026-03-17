import './globals.css';
import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'Chiesi Operational Committee',
  description: 'Monthly close system and executive viewer',
  openGraph: {
    title: 'Chiesi Operational Committee',
    description: 'Monthly close system and executive viewer',
    images: ['/chiesi_og.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chiesi Operational Committee',
    description: 'Monthly close system and executive viewer',
    images: ['/chiesi_og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
