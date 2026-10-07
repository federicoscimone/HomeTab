/**
 * @fileoverview TrendChart — 6-month income vs expense area chart.
 */

'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * @typedef {Object} TrendDataPoint
 * @property {string} label   - Month label (e.g. "Mar 2025").
 * @property {number} expense - Total expenses for the month.
 * @property {number} income  - Total income for the month.
 */

/**
 * Custom tooltip for the trend area chart.
 *
 * @param {object} props - Recharts tooltip props.
 */
const CustomTooltip = ({ active, payload, label }) => {
  const { fmt } = useFormat();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

/**
 * Area chart showing the last N months of income and expense totals.
 *
 * @param {object}           props
 * @param {TrendDataPoint[]} props.data - Monthly trend data points.
 */
export default function TrendChart({ data }) {
  const t = useTranslations('common');
  const { fmtAxis } = useFormat();
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">
        {t('noData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} width={50} />
        <Tooltip content={<CustomTooltip />} />
        {/* Ordine per dataKey, uguale in ogni lingua (quello predefinito è alfabetico sull'etichetta). */}
        <Legend itemSorter="dataKey" formatter={v => <span className="text-xs">{v}</span>} />
        <Area type="monotone" dataKey="expense" name={t('expenses')}
          stroke="#ef4444" fill="url(#gradExpense)" strokeWidth={2} dot={{ r: 3 }} />
        <Area type="monotone" dataKey="income"  name={t('income')}
          stroke="#22c55e" fill="url(#gradIncome)"  strokeWidth={2} dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
