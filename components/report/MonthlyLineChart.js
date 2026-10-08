/**
 * @fileoverview MonthlyLineChart — current vs previous year line chart for a single category.
 */

'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * @typedef {Object} MonthlyDataPoint
 * @property {number} month - Month number (1–12).
 * @property {number|null} cur - Current year amount; null for months not yet reached.
 * @property {number} prev  - Previous year amount.
 */

/**
 * Custom tooltip for the monthly line chart.
 *
 * @param {object} props - Recharts tooltip props.
 */
const CustomTooltip = ({ active, payload, label }) => {
  const { fmtFull } = useFormat();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.filter(p => p.value !== null && p.value !== undefined).map((p, i) => (
        <p key={i} style={{ color: p.color }}>{`${p.name}: ${fmtFull(p.value)}`}</p>
      ))}
    </div>
  );
};

/**
 * Line chart comparing a category's monthly spend for the current year (solid)
 * and the previous year (dashed).
 *
 * @param {object}             props
 * @param {MonthlyDataPoint[]} props.data      - Monthly data points.
 * @param {string}             [props.color]   - Hex colour for the current-year line.
 * @param {number}             props.year      - Current year label.
 * @param {number}             props.prevYear  - Previous year label.
 */
export default function MonthlyLineChart({ data, color = '#6366f1', year, prevYear }) {
  const t = useTranslations('common');
  const { monthsShort, fmtAxis } = useFormat();
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">
        {t('noData')}
      </div>
    );
  }

  const chartData = data.map(d => ({
    month:    monthsShort[d.month - 1],
    // Il mese in corso non si disegna: pochi giorni accanto a mesi interi sembrerebbero un crollo.
    [year]:     d.partial ? null : d.cur,
    [prevYear]: d.prev,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} width={50} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={v => <span className="text-xs">{v}</span>} />
        <Line
          type="monotone" dataKey={String(year)} stroke={color}
          strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
        />
        <Line
          type="monotone" dataKey={String(prevYear)} stroke="#94a3b8"
          strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
