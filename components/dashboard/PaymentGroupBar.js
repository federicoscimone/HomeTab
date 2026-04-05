/**
 * @fileoverview PaymentGroupBar — proportional bar showing traditional vs alternative spend.
 */

'use client';

import { fmtFull } from '@/lib/utils/format';

/**
 * Horizontal split bar comparing traditional and alternative payment method totals.
 *
 * @param {object} props
 * @param {number} [props.traditional=0] - Total spent via traditional methods (€).
 * @param {number} [props.alternative=0] - Total spent via alternative methods (€).
 */
export default function PaymentGroupBar({ traditional = 0, alternative = 0 }) {
  const total    = traditional + alternative;
  const tradPct  = total > 0 ? (traditional / total) * 100 : 0;
  const altPct   = total > 0 ? (alternative / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-sm flex-wrap gap-1">
        <div>
          <span className="badge badge-info badge-sm mr-1">Tradizionali</span>
          <span className="font-semibold">{fmtFull(traditional)}</span>
          <span className="text-base-content/40 text-xs ml-1">({tradPct.toFixed(0)}%)</span>
        </div>
        <div className="text-right">
          <span className="badge badge-warning badge-sm mr-1">Alternativi</span>
          <span className="font-semibold">{fmtFull(alternative)}</span>
          <span className="text-base-content/40 text-xs ml-1">({altPct.toFixed(0)}%)</span>
        </div>
      </div>

      {total > 0 ? (
        <div className="w-full h-4 bg-base-200 rounded-full overflow-hidden flex">
          <div className="bg-info h-full transition-all"    style={{ width: `${tradPct}%` }} />
          <div className="bg-warning h-full transition-all" style={{ width: `${altPct}%`  }} />
        </div>
      ) : (
        <div className="w-full h-4 bg-base-200 rounded-full" />
      )}

      <p className="text-xs text-base-content/40 text-center">Totale uscite: {fmtFull(total)}</p>
    </div>
  );
}
