import type { Metadata, Viewport } from 'next';
import { Pwa } from './pwa';
import './globals.css';
export const metadata: Metadata = {
  title: 'Together · Our budget notebook',
  icons: { icon: '/favicon.svg', apple: '/icons/apple-touch-icon.png' },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Together', statusBarStyle: 'default' },
  description:
    'A little planning. More room for life. A private household budget notebook.',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#315d48',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
