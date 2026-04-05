/**
 * @fileoverview CategoryBarChart — top-10 categories bar chart with optional YoY comparison.
 */

'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { fmtFull } from '@/lib/utils/format';

/**
 * Custom tooltip for the category bar chart.
 *
 * @param {object} props - Recharts tooltip props.
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmtFull(p.value)}</p>
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
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">
        Nessun dato
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
        <YAxis tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={45} />
        <Tooltip content={<CustomTooltip />} />
        {showPrev && <Legend formatter={v => <span className="text-xs">{v}</span>} />}
        <Bar dataKey="cur" name="Anno corr." radius={[4, 4, 0, 0]}>
          {chartData.map((c, i) => <Cell key={i} fill={c.color} />)}
        </Bar>
        {showPrev && (
          <Bar dataKey="prev" name="Anno prec." fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.5} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
