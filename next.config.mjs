/** @type {import('next').NextConfig} */
// BUILD_TARGET=container è impostato solo dal Dockerfile: su Vercel resta undefined
// e la configurazione è identica a quella di sempre.
const nextConfig = {
  ...(process.env.BUILD_TARGET === 'container' && { output: 'standalone' }),
};

export default nextConfig;
