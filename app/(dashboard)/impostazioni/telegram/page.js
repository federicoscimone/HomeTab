import { getTranslations } from 'next-intl/server';
import TelegramSettings from '@/components/settings/TelegramSettings';

export default async function TelegramPage() {
  const t = await getTranslations('settingsTelegram');
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('pageTitle')}</h1>
      <TelegramSettings />
    </div>
  );
}
