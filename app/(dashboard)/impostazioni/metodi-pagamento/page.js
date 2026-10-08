import { useTranslations } from 'next-intl';
import { PAYMENT_METHODS } from '@/lib/utils/payments';

export default function MetodiPagamentoPage() {
  const t = useTranslations('paymentMethodsPage');
  const tPay = useTranslations('payments');
  const tGroups = useTranslations('paymentGroups');
  const groups = [
    { key: 'traditional', badge: 'badge-info', title: t('traditionalTitle'), one: t('traditionalOne') },
    { key: 'alternative', badge: 'badge-warning', title: t('alternativeTitle'), one: t('alternativeOne') },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-base-content/50 mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <div key={g.key} className="card bg-base-100 border border-base-200 shadow-sm">
            <div className="card-body py-4">
              <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
                <span className={`badge ${g.badge} badge-sm`}>{tGroups(g.key)}</span>
                {g.title}
              </h2>
              <div className="flex flex-col divide-y divide-base-200">
                {PAYMENT_METHODS.filter((m) => m.group === g.key).map((m) => (
                  <div key={m.value} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`badge ${m.color} badge-outline badge-sm`}>{tPay(m.value)}</span>
                      <span className="text-xs text-base-content/40 font-mono">{m.value}</span>
                    </div>
                    <span className="text-xs text-base-content/50">{g.one}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="alert alert-info text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{t('note')}</span>
        </div>
      </div>
    </div>
  );
}
