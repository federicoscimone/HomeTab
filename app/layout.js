import './globals.css';
import Script from 'next/script';
import SessionProvider from '@/components/layout/SessionProvider';
import ServiceWorkerRegistration from '@/components/layout/ServiceWorkerRegistration';

export const metadata = {
  title: 'HomeBI — Movimenti Personali',
  description: 'Traccia e analizza i tuoi movimenti personali',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HomeBI',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.svg', type: 'image/svg+xml', sizes: '192x192' },
      { url: '/icons/icon-512.svg', type: 'image/svg+xml', sizes: '512x512' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6366f1' },
    { media: '(prefers-color-scheme: dark)',  color: '#1d232a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Inline script to prevent FOUC — runs before React hydrates
const themeScript = `
  try {
    var t = localStorage.getItem('homebi-theme');
    if (!t) {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>
        {/* Must run before paint — sets data-theme to prevent FOUC */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <SessionProvider>
          {children}
          <ServiceWorkerRegistration />
        </SessionProvider>
      </body>
    </html>
  );
}
