/**
 * @fileoverview GoalChart — andamento dell'accantonato di un obiettivo e proiezione fino alla scadenza.
 *
 * Una sola grandezza (l'accantonato) in due tratti: pieno per i mesi chiusi, tratteggiato per la
 * proiezione. Nessuna legenda: le linee di riferimento (importo e scadenza) hanno etichetta diretta.
 */

'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';
import { addMonths } from '@/lib/utils/goalMath';

const SERIES_COLOR = '#6366f1'; // stesso primario dei grafici esistenti
const REFERENCE_COLOR = '#94a3b8';

/**
 * Massimo dell'asse arrotondato a un passo "tondo" (1; 2; 2,5 o 5 × 10ⁿ) diviso in 4 tacche:
 * lasciato a Recharts, un massimo come 16.200 produce tacche irregolari (4,5k / 9k / 14k).
 *
 * @param {number} max
 * @returns {{ top: number, ticks: number[] }}
 */
function niceAxis(max) {
  const raw = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= raw);
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
}

const CustomTooltip = ({ active, payload, label }) => {
  const t = useTranslations('goalChart');
  const { fmtFull, fmtMonth } = useFormat();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-base-100 border border-base-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium mb-1">{fmtMonth(label)}</p>
      {row.saved != null && <p>{t('saved', { amount: fmtFull(row.saved) })}</p>}
      {row.projected != null && row.saved == null && (
        <p className="text-base-content/70">{t('projected', { amount: fmtFull(row.projected) })}</p>
      )}
    </div>
  );
};

/**
 * @param {object} props
 * @param {object} props.goal         - Obiettivo come restituito da /api/obiettivi/[id].
 * @param {string} props.currentMonth - 'YYYY-MM'.
 */
export default function GoalChart({ goal, currentMonth }) {
  const t = useTranslations('goalChart');
  const { fmt, fmtMonth, fmtAxis } = useFormat();
  const lastClosed = addMonths(currentMonth, -1);

  // Storico: fine di ogni mese chiuso. Il punto del mese in corso è escluso perché non è ancora
  // stato ripartito: la proiezione parte dall'accantonato attuale, agganciata all'ultimo mese chiuso.
  const history = goal.series.filter((p) => p.month <= lastClosed);
  const byMonth = new Map(history.map((p) => [p.month, { month: p.month, saved: p.saved }]));

  if (goal.projection?.series.length) {
    const anchor = byMonth.get(lastClosed) ?? { month: lastClosed };
    anchor.projected = goal.saved;
    byMonth.set(lastClosed, anchor);
    for (const p of goal.projection.series) byMonth.set(p.month, { month: p.month, projected: p.projected });
  }

  const data = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-base-content/40 text-sm text-center px-4">
        {t('empty')}
      </div>
    );
  }

  const maxValue = Math.max(goal.targetAmount, ...data.map((d) => Math.max(d.saved ?? 0, d.projected ?? 0)));
  const minValue = Math.min(0, ...data.map((d) => Math.min(d.saved ?? 0, d.projected ?? 0)));
  // Margine del 5% sopra il massimo, così la linea dell'importo non tocca il bordo del grafico.
  const axis = niceAxis(maxValue * 1.05);
  const deadlineVisible = data.some((d) => d.month === goal.deadline);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => fmtMonth(m, true)} tick={{ fontSize: 11 }} minTickGap={16} />
        <YAxis
          domain={[minValue, axis.top]}
          ticks={minValue < 0 ? undefined : axis.ticks}
          tickFormatter={fmtAxis}
          tick={{ fontSize: 11 }} width={56}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={goal.targetAmount} stroke={REFERENCE_COLOR} strokeDasharray="6 3"
          label={{ value: t('target', { amount: fmt(goal.targetAmount) }), position: 'insideTopLeft', fontSize: 11, fill: REFERENCE_COLOR }}
        />
        {deadlineVisible && (
          <ReferenceLine
            x={goal.deadline} stroke={REFERENCE_COLOR} strokeDasharray="6 3"
            label={{ value: t('deadline'), position: 'insideTopRight', fontSize: 11, fill: REFERENCE_COLOR }}
          />
        )}
        <Line
          type="monotone" dataKey="saved" name={t('savedSeries')} stroke={SERIES_COLOR}
          strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false}
        />
        <Line
          type="monotone" dataKey="projected" name={t('projectedSeries')} stroke={SERIES_COLOR}
          strokeWidth={2} strokeDasharray="5 4" strokeOpacity={0.6} dot={false} activeDot={{ r: 4 }}
          connectNulls={false} isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
