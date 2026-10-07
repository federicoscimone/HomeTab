import createNextIntlPlugin from 'next-intl/plugin';

// Il plugin collega next-intl alla configurazione per richiesta in i18n/request.js.
const withNextIntl = createNextIntlPlugin('./i18n/request.js');

/** @type {import('next').NextConfig} */
// BUILD_TARGET=container è impostato solo dal Dockerfile: su Vercel resta undefined
// e la configurazione è identica a quella di sempre.
const nextConfig = {
  ...(process.env.BUILD_TARGET === 'container' && { output: 'standalone' }),
};

export default withNextIntl(nextConfig);
