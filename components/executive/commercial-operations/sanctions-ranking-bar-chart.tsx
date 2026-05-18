'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type SanctionsRankingPoint = {
  label: string;
  amount: number;
  pyAmount: number;
};

type SanctionsRankingBarChartProps = {
  rows: SanctionsRankingPoint[];
  emptyLabel?: string;
};

function formatCompactCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function SanctionsRankingBarChart({
  rows,
  emptyLabel = 'No sanctions rows in the selected scope.',
}: SanctionsRankingBarChartProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-[16px] border border-dashed border-slate-200 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full rounded-[16px] border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 12 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            stroke="#64748b"
            fontSize={11}
            tickFormatter={(value) => (typeof value === 'number' ? formatCompactCurrency(value) : String(value))}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            stroke="#334155"
            fontSize={11}
            width={170}
            tickFormatter={(value) => String(value).slice(0, 28)}
          />
          <Tooltip
            formatter={(value: unknown, name) => [
              typeof value === 'number' ? formatCompactCurrency(value) : 'N/A',
              name === 'amount' ? 'Current' : 'PY',
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="amount" name="Current" fill="#0f172a" radius={[0, 6, 6, 0]} />
          <Bar dataKey="pyAmount" name="PY" fill="#94a3b8" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
