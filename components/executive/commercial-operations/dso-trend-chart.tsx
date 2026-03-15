'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DsoTrendPoint = {
  periodMonth: string;
  dsoValue: number;
  targetValue: number | null;
  stockValue?: number | null;
  sellOutValue?: number | null;
};

type DsoTrendChartProps = {
  rows: DsoTrendPoint[];
  metricLabel?: string;
};

function formatMonthShort(value: string) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
}

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(1);
}

export function DsoTrendChart({ rows, metricLabel = 'DSO' }: DsoTrendChartProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[16px] border border-dashed border-slate-200 text-sm text-slate-500">
        No {metricLabel} trend data available for the selected group.
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full rounded-[16px] border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
          <XAxis
            dataKey="periodMonth"
            tickFormatter={formatMonthShort}
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => {
              if (String(name) === 'stockValue') return [typeof value === 'number' ? formatNumber(value) : 'N/A', 'Stock'];
              if (String(name) === 'sellOutValue') return [typeof value === 'number' ? formatNumber(value) : 'N/A', 'Sell-out'];
              return [typeof value === 'number' ? formatNumber(value) : 'N/A', String(name) === 'dsoValue' ? metricLabel : 'Target'];
            }}
            labelFormatter={(label) => formatMonthShort(String(label))}
          />
          <Line
            type="monotone"
            dataKey="dsoValue"
            name="dsoValue"
            yAxisId="left"
            stroke="#0f172a"
            strokeWidth={2.5}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="targetValue"
            name="targetValue"
            yAxisId="left"
            stroke="#f59e0b"
            strokeDasharray="6 5"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="stockValue"
            name="stockValue"
            yAxisId="right"
            stroke="#64748b"
            strokeOpacity={0.35}
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="sellOutValue"
            name="sellOutValue"
            yAxisId="right"
            stroke="#16a34a"
            strokeOpacity={0.35}
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
