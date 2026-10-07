import ImportWizard from '@/components/import/ImportWizard';
import { isDemoMode } from '@/lib/demoAccounts';

export default function ImportaPage() {
  // Nella demo si offre un estratto conto di esempio, da importare con il template della demo.
  return <ImportWizard sampleHref={isDemoMode() ? '/api/import/sample' : null} />;
}
