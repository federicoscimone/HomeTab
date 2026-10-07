import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  return { title: (await getTranslations('meta'))('offlineTitle') };
}

export default async function OfflinePage() {
  const t = await getTranslations('offline');
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 text-center px-6">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-primary mb-6" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
      <h1 className="text-3xl font-bold mb-3">{t('title')}</h1>
      <p className="text-base-content/60 max-w-sm mb-8">{t('text')}</p>
      {/* Un <a> e non <Link>: offline la navigazione client fallirebbe, mentre un caricamento
          completo passa dal service worker, che riprova la rete o rimostra questa pagina. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn btn-primary">{t('retry')}</a>
    </div>
  );
}
