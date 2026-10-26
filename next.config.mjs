import createNextIntlPlugin from 'next-intl/plugin';

// Il plugin collega next-intl alla configurazione per richiesta in i18n/request.js.
const withNextIntl = createNextIntlPlugin('./i18n/request.js');

/**
 * Header di sicurezza su ogni risposta. Niente Content-Security-Policy completa: Next inserisce
 * script inline che richiederebbero un nonce per richiesta; frame-ancestors da sola basta contro
 * il clickjacking (un'altra pagina che mostra l'app in un iframe invisibile e fa cliccare
 * «Elimina» a chi è collegato). La fotocamera serve allo scatto degli scontrini, solo dall'app.
 */
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Il link di reset della password porta il token nell'URL: verso altri siti parte solo l'origine.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
// BUILD_TARGET=container è impostato solo dal Dockerfile: su Vercel resta undefined
// e la configurazione è identica a quella di sempre.
const nextConfig = {
  ...(process.env.BUILD_TARGET === 'container' && { output: 'standalone' }),
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
