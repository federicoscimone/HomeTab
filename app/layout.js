import './globals.css';
import SessionProvider from '@/components/layout/SessionProvider';

export const metadata = {
  title: 'HomeBI — Spese Personali',
  description: 'Traccia e analizza le tue spese personali',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it" data-theme="light">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
