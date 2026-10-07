import './globals.css';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import SessionProvider from '@/components/layout/SessionProvider';
import ServiceWorkerRegistration from '@/components/layout/ServiceWorkerRegistration';
import DemoBanner from '@/components/layout/DemoBanner';
import { isDemoMode } from '@/lib/demoAccounts';

export const metadata = {
  title: 'HomeTab — Family Manager',
  description: 'Traccia e analizza i tuoi movimenti familiari',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HomeTab',
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

export default async function RootLayout({ children }) {
  // Durante la build dell'immagine container non esiste un database raggiungibile:
  // BUILD_TARGET è impostato solo nello stage builder del Dockerfile, mai a runtime
  // né su Vercel, dove questo blocco si comporta esattamente come prima.
  // Il seed della demo è in instrumentation.js, eseguito una volta all'avvio del server.
  if (process.env.BUILD_TARGET !== 'container') {
    await connectDB();
  }

  const session = await auth();
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get('hometab-theme')?.value;
  const validThemes = ['light', 'dark', 'forest', 'aqua', 'abyss'];
  const theme = validThemes.includes(cookieTheme) ? cookieTheme : 'light';
  return (
    <html lang="it" data-theme={theme} suppressHydrationWarning>
      <body>
        <SessionProvider session={session}>
          {isDemoMode() && <DemoBanner />}
          {children}
          <ServiceWorkerRegistration />
        </SessionProvider>
      </body>
    </html>
  );
}
