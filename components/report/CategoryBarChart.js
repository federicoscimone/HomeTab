/**
 * @fileoverview CategoryBarChart — top-10 categories bar chart with optional YoY comparison.
 */

'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * Custom tooltip for the category bar chart.
 *
 * @param {object} props - Recharts tooltip props.
 */
const CustomTooltip = ({ active, payload, label }) => {
  const { fmtFull } = useFormat();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{`${p.name}: ${fmtFull(p.value)}`}</p>
      ))}
    </div>
  );
};

/**
 * @typedef {Object} CategoryBarData
 * @property {string} categoryName - Display name.
 * @property {string} color        - Hex colour for the current-year bar.
 * @property {number} totalCur     - Current year / period total.
 * @property {number} totalPrev    - Previous year / period total (needed when showPrev=true).
 */

/**
 * Horizontal grouped bar chart of the top 10 categories by spend.
 * Optionally shows the previous period as a second (grey) bar.
 *
 * @param {object}           props
 * @param {CategoryBarData[]} props.data      - Category data (at most 10 are shown).
 * @param {boolean}          [props.showPrev] - If true, render a second bar for the previous period.
 */
export default function CategoryBarChart({ data, showPrev = false }) {
  const t = useTranslations('reports');
  const tCommon = useTranslations('common');
  const { fmtAxis } = useFormat();
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">
        {tCommon('noData')}
      </div>
    );
  }

  const chartData = data.slice(0, 10).map(c => ({
    name:  c.categoryName || c.name,
    color: c.color,
    cur:   c.totalCur  ?? c.cur  ?? 0,
    prev:  c.totalPrev ?? c.prev ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} width={50} />
        <Tooltip content={<CustomTooltip />} />
        {/* In alto: in basso la legenda si sovrapponeva ai nomi inclinati delle categorie.
            Ordinata per dataKey (cur, prev) come le barre: l'ordine predefinito è alfabetico
            sull'etichetta, e in inglese "Last year" finiva prima di "This year". */}
        {showPrev && <Legend verticalAlign="top" itemSorter="dataKey" formatter={v => <span className="text-xs">{v}</span>} />}
        {/* Il fill vale solo per la legenda: ogni barra prende il colore della categoria dalla Cell. */}
        <Bar dataKey="cur" name={t('currentYear')} fill="#64748b" radius={[4, 4, 0, 0]}>
          {chartData.map((c, i) => <Cell key={i} fill={c.color} />)}
        </Bar>
        {showPrev && (
          <Bar dataKey="prev" name={t('previousYear')} fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.5} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
