'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DsoComparisonBarChartProps = {
  pyAvg: number | null;
  target: number | null;
  mMinus1: number | null;
  current: number | null;
  metricLabel?: string;
  pyAvgLabel?: string;
  targetLabel?: string;
  mMinus1Label?: string;
  currentLabel?: string;
};

function formatValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(1);
}

export function DsoComparisonBarChart({
  pyAvg,
  target,
  mMinus1,
  current,
  metricLabel = 'DSO',
  pyAvgLabel = 'Average PY',
  targetLabel = 'Current Target',
  mMinus1Label = 'Previous Month',
  currentLabel = 'Current Month',
}: DsoComparisonBarChartProps) {
  const rows = [
    { label: pyAvgLabel, value: pyAvg, color: '#94a3b8' },
    { label: targetLabel, value: target, color: '#f59e0b' },
    { label: mMinus1Label, value: mMinus1, color: '#86efac' },
    { label: currentLabel, value: current, color: '#16a34a' },
  ];

  const hasAny = rows.some((row) => row.value != null);
  if (!hasAny) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[16px] border border-dashed border-slate-200 text-sm text-slate-500">
        No comparison data available for selected group.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full rounded-[16px] border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            stroke="#64748b"
            fontSize={12}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={68}
          />
          <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} width={48} />
          <Tooltip
            formatter={(value: unknown) => [typeof value === 'number' ? formatValue(value) : 'N/A', metricLabel]}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {rows.map((row) => (
              <Cell key={`cell-${row.label}`} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
