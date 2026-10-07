import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demoAccounts';

/**
 * Striscia in cima a ogni pagina quando l'app gira come demo pubblica. Sulla pagina di login è
 * la cosa più utile: chi arriva da un link trova subito le credenziali per entrare.
 */
export default function DemoBanner() {
  return (
    <div className="bg-base-200 border-b border-base-300 text-base-content/80 text-xs sm:text-sm text-center px-4 py-1.5">
      Demo con dati fittizi, condivisa da tutti i visitatori. Accesso:{' '}
      <strong>{DEMO_ACCOUNTS[0].email}</strong> / <strong>{DEMO_PASSWORD}</strong>
    </div>
  );
}
