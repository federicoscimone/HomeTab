export const metadata = {
  title: 'Offline — HomeBI',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 text-center px-6">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-primary mb-6" fill="none"
        viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
      <h1 className="text-3xl font-bold mb-3">Sei offline</h1>
      <p className="text-base-content/60 max-w-sm mb-8">
        HomeBI non è raggiungibile al momento. Controlla la connessione internet e riprova.
      </p>
      <a href="/" className="btn btn-primary">
        Riprova
      </a>
    </div>
  );
}
