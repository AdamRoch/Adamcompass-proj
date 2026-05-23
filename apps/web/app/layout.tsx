import './globals.css';
import type { Metadata, Viewport } from 'next';
import * as settingsQ from '@compass/db/queries/settings';

export const metadata: Metadata = {
  title: 'Compass',
  description: 'A personal dashboard for projects, learning, and notes.',
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0e14' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read active theme from server settings so first paint matches the user's choice
  let theme = 'white_minimal';
  try {
    const s = await settingsQ.getSettings();
    theme = s.active_theme;
  } catch {
    // pre-migration boot: fall back to default
  }

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
