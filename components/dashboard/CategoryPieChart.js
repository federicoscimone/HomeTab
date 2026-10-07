/**
 * @fileoverview CategoryPieChart — donut chart for category spend breakdown.
 */

'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * @typedef {Object} PieDataPoint
 * @property {string|null} categoryId - Linked category id (null for uncategorized).
 * @property {string} name   - Category name.
 * @property {number} amount - Total amount in euros.
 * @property {string} color  - Hex fill colour.
 */

/**
 * Custom tooltip for the pie chart.
 *
 * @param {object} props - Recharts tooltip props.
 */
const CustomTooltip = ({ active, payload }) => {
  const { fmtFull } = useFormat();
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-primary">{fmtFull(payload[0].value)}</p>
    </div>
  );
};

/**
 * Donut pie chart showing spend breakdown by category.
 * Segments smaller than 5% do not show a label.
 *
 * @param {object}        props
 * @param {PieDataPoint[]} props.data - Category amounts to render.
 * @param {(entry: PieDataPoint) => void} [props.onCategoryClick] - Click handler for a pie slice.
 */
export default function CategoryPieChart({ data, onCategoryClick }) {
  const t = useTranslations('common');
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">
        {t('noData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      {/* Margine in alto: l'etichetta di una fetta in cima finiva fuori dall'area e veniva tagliata. */}
      <PieChart margin={{ top: 16 }}>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={50}
          paddingAngle={2}
          label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
          labelLine={false}
          onClick={(_, index) => {
            if (!onCategoryClick || typeof index !== 'number') return;
            onCategoryClick(data[index]);
          }}
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.color}
              style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={value => <span className="text-xs">{value}</span>}
          iconSize={10}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
