import { getTranslations } from 'next-intl/server';
import AiCard from '@/components/settings/AiCard';

export default async function IaPage() {
  const t = await getTranslations('settingsAi');
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('pageTitle')}</h1>
      <AiCard />
    </div>
  );
}
