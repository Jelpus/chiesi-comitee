'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type SanctionsPiePoint = {
  label: string;
  amount: number;
};

type SanctionsPieChartProps = {
  rows: SanctionsPiePoint[];
  emptyLabel?: string;
};

const COLORS = ['#0f172a', '#2563eb', '#0f766e', '#7c3aed', '#be123c', '#ca8a04', '#475569', '#16a34a'];

function formatCompactCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function SanctionsPieChart({
  rows,
  emptyLabel = 'No sanctions rows in the selected scope.',
}: SanctionsPieChartProps) {
  const visibleRows = rows.filter((row) => row.amount > 0).slice(0, 8);

  if (visibleRows.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-[16px] border border-dashed border-slate-200 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-[300px] rounded-[16px] border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={visibleRows}
            dataKey="amount"
            nameKey="label"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            labelLine={false}
          >
            {visibleRows.map((row, index) => (
              <Cell key={row.label} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: unknown) => (typeof value === 'number' ? formatCompactCurrency(value) : 'N/A')} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
