'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BusinessExcellencePrivateMarketChartPoint } from '@/types/business-excellence';
import type { BusinessExcellencePrivateDddDimensionRankingRow } from '@/types/business-excellence';
import type { BusinessExcellencePrivatePrescriptionDimensionRankingRow } from '@/types/business-excellence';
import type { BusinessExcellencePrivateWeeklyBenchmark } from '@/types/business-excellence';

type PrivateMarketGroupChartsProps = {
  rows: BusinessExcellencePrivateMarketChartPoint[];
  dddRankingRows: BusinessExcellencePrivateDddDimensionRankingRow[];
  prescriptionRankingRows: BusinessExcellencePrivatePrescriptionDimensionRankingRow[];
  weeklyBenchmark: BusinessExcellencePrivateWeeklyBenchmark | null;
  initialMarketGroup?: string;
};

function formatWeekLabel(value: string | null | undefined) {
  if (!value) return 'N/A';
  const normalized = String(value).trim();
  if (!/^\d{6}$/.test(normalized)) return normalized;
  const year = normalized.slice(0, 4);
  const week = String(Number(normalized.slice(4)));
  return `W${week} ${year}`;
}

function formatShortMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
}

export function PrivateMarketGroupCharts({
  rows,
  dddRankingRows,
  prescriptionRankingRows,
  weeklyBenchmark,
  initialMarketGroup,
}: PrivateMarketGroupChartsProps) {
  const [rankingMode, setRankingMode] = useState<'pack' | 'brand' | 'state' | 'manager' | 'territory'>('brand');
  const [prescriptionRankingMode, setPrescriptionRankingMode] = useState<'product' | 'brand' | 'specialty' | 'territory'>('brand');
  const [dataScope, setDataScope] = useState<'all' | 'chiesi'>('all');
  const marketGroups = useMemo(
    () => Array.from(new Set(rows.map((row) => row.marketGroup))).sort(),
    [rows],
  );

  const [selectedMarketGroup, setSelectedMarketGroup] = useState(
    initialMarketGroup && marketGroups.includes(initialMarketGroup)
      ? initialMarketGroup
      : marketGroups[0] ?? '',
  );

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => row.marketGroup === selectedMarketGroup && row.scope === dataScope)
        .map((row) => ({
          ...row,
          periodLabel: formatShortMonth(row.periodMonth),
        })),
    [rows, selectedMarketGroup, dataScope],
  );

  const filteredPackRankingRows = useMemo(
    () =>
      dddRankingRows
        .filter((row) => (
          row.marketGroup === selectedMarketGroup
          && row.dimension === rankingMode
          && row.scope === dataScope
        ))
        .sort((a, b) => b.ytdUnits - a.ytdUnits),
    [dddRankingRows, rankingMode, dataScope, selectedMarketGroup],
  );

  const filteredPrescriptionRankingRows = useMemo(
    () =>
      prescriptionRankingRows
        .filter((row) => (
          row.marketGroup === selectedMarketGroup
          && row.dimension === prescriptionRankingMode
          && row.scope === dataScope
        ))
        .sort((a, b) => b.ytdRx - a.ytdRx),
    [prescriptionRankingRows, prescriptionRankingMode, dataScope, selectedMarketGroup],
  );

  const filteredWeeklyBenchmarkRows = useMemo(
    () =>
      (weeklyBenchmark?.rows ?? [])
        .filter((row) => row.marketGroup === selectedMarketGroup && row.scope === dataScope)
        .sort((a, b) => b.week4Units - a.week4Units),
    [weeklyBenchmark, selectedMarketGroup, dataScope],
  );
  const selectedMarketWeeklyTotal = useMemo(
    () => (weeklyBenchmark?.totals ?? []).find((row) => row.marketGroup === selectedMarketGroup && row.scope === dataScope) ?? null,
    [weeklyBenchmark, selectedMarketGroup, dataScope],
  );

  if (rows.length === 0) return null;

  return (
    <div className="mt-4 space-y-4 rounded-[18px] border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Market Group
          </span>
          <select
            value={selectedMarketGroup}
            onChange={(event) => setSelectedMarketGroup(event.target.value)}
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {marketGroups.map((marketGroup) => (
              <option key={marketGroup} value={marketGroup}>
                {marketGroup}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[180px] flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Data Scope
          </span>
          <select
            value={dataScope}
            onChange={(event) => setDataScope(event.target.value as 'all' | 'chiesi')}
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">All Market</option>
            <option value="chiesi">Chiesi Only</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[16px] border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3.5" y="7" width="13" height="9" rx="1.8" />
                <path d="M6 7V4.5h8V7" />
              </svg>
            </span>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">DDD Sell Out</p>
          </div>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pmmUnits"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  dot={false}
                  name="Units"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pmmNetSales"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                  name="Net Sales"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Ranking Mode</p>
            <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white p-1">
              {(
                [
                  { key: 'brand', label: 'Brand' },
                  { key: 'pack', label: 'Pack' },
                  { key: 'state', label: 'State' },
                  { key: 'manager', label: 'Manager' },
                  { key: 'territory', label: 'Territory' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setRankingMode(mode.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                    rankingMode === mode.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 max-h-[230px] overflow-auto scrollbar-none rounded-[12px] border border-slate-200">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700">
                    {rankingMode === 'pack'
                      ? 'Pack'
                      : rankingMode === 'brand'
                        ? 'Brand'
                      : rankingMode === 'state'
                        ? 'State'
                        : rankingMode === 'manager'
                          ? 'Manager'
                          : 'Territory'}
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">YTD Units</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">YTD PY Units</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">Growth vs PY</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackRankingRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                    <td className="max-w-[420px] truncate px-2 py-1.5 text-slate-800">{row.label}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-900">{new Intl.NumberFormat('en-US').format(row.ytdUnits)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-700">{new Intl.NumberFormat('en-US').format(row.ytdPyUnits)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${
                      row.growthVsPyPct === null
                        ? 'text-slate-500'
                        : row.growthVsPyPct >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                    >
                      {row.growthVsPyPct === null ? 'N/A' : `${row.growthVsPyPct > 0 ? '+' : ''}${row.growthVsPyPct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {filteredPackRankingRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-slate-500" colSpan={4}>No ranking available for selected mode and market group.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[16px] border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10" cy="6" r="2.5" />
                <path d="M6.8 16v-2.2a3.2 3.2 0 0 1 6.4 0V16" />
                <path d="M4.2 10.2h2.4m7.2 0h2.1" />
              </svg>
            </span>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">Prescription Trend</p>
          </div>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="closeupRx" fill="#7c3aed" name="Rx" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Ranking Mode</p>
            <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white p-1">
              {(
                [
                  { key: 'brand', label: 'Brand' },
                  { key: 'product', label: 'Product' },
                  { key: 'specialty', label: 'Specialty' },
                  { key: 'territory', label: 'Territory' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setPrescriptionRankingMode(mode.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                    prescriptionRankingMode === mode.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 max-h-[230px] overflow-auto scrollbar-none rounded-[12px] border border-slate-200">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700">
                    {prescriptionRankingMode === 'product'
                      ? 'Product'
                      : prescriptionRankingMode === 'brand'
                        ? 'Brand'
                      : prescriptionRankingMode === 'specialty'
                        ? 'Specialty'
                        : 'Territory'}
                  </th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">YTD Rx</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">YTD PY Rx</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">Growth vs PY</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrescriptionRankingRows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                    <td className="max-w-[420px] truncate px-2 py-1.5 text-slate-800">{row.label}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-900">{new Intl.NumberFormat('en-US').format(row.ytdRx)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-700">{new Intl.NumberFormat('en-US').format(row.ytdPyRx)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${
                      row.growthVsPyPct === null
                        ? 'text-slate-500'
                        : row.growthVsPyPct >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}>
                      {row.growthVsPyPct === null ? 'N/A' : `${row.growthVsPyPct > 0 ? '+' : ''}${row.growthVsPyPct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {filteredPrescriptionRankingRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-slate-500" colSpan={4}>No ranking available for selected mode and market group.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="rounded-[16px] border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">Weekly Benchmark (DDD Private Sell Out)</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
            Last 4 weeks
          </p>
        </div>
        <div className="mt-3 overflow-auto scrollbar-none rounded-[12px] border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700">Market Group - Brand</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">{formatWeekLabel(weeklyBenchmark?.week1Raw)}</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">{formatWeekLabel(weeklyBenchmark?.week2Raw)}</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">{formatWeekLabel(weeklyBenchmark?.week3Raw)}</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">{formatWeekLabel(weeklyBenchmark?.week4Raw)}</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">% Growth WoW</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">%MS W-1</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">%MS W</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">Evolution Index</th>
              </tr>
            </thead>
            <tbody>
              {filteredWeeklyBenchmarkRows.map((row) => (
                <tr key={`${row.marketGroup}-${row.brandLabel}`} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-1.5 text-slate-800">{row.marketGroup} - {row.brandLabel}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(row.week1Units)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(row.week2Units)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(row.week3Units)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(row.week4Units)}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${row.wowGrowthPct === null ? 'text-slate-500' : row.wowGrowthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.wowGrowthPct === null ? 'N/A' : `${row.wowGrowthPct > 0 ? '+' : ''}${row.wowGrowthPct.toFixed(1)}%`}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-700">{row.msWeekFromPct === null ? 'N/A' : `${row.msWeekFromPct.toFixed(1)}%`}</td>
                  <td className="px-2 py-1.5 text-right text-slate-700">{row.msWeekToPct === null ? 'N/A' : `${row.msWeekToPct.toFixed(1)}%`}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${
                    row.evolutionIndex === null
                      ? 'text-slate-500'
                      : row.evolutionIndex >= 100
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}>{row.evolutionIndex === null ? 'N/A' : row.evolutionIndex.toFixed(0)}</td>
                </tr>
              ))}
              {selectedMarketWeeklyTotal ? (
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-2 py-2 text-slate-900">TOTAL</td>
                  <td className="px-2 py-2 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(selectedMarketWeeklyTotal.week1Units)}</td>
                  <td className="px-2 py-2 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(selectedMarketWeeklyTotal.week2Units)}</td>
                  <td className="px-2 py-2 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(selectedMarketWeeklyTotal.week3Units)}</td>
                  <td className="px-2 py-2 text-right text-slate-900">{new Intl.NumberFormat('en-US').format(selectedMarketWeeklyTotal.week4Units)}</td>
                  <td className={`px-2 py-2 text-right ${selectedMarketWeeklyTotal.wowGrowthPct === null ? 'text-slate-500' : selectedMarketWeeklyTotal.wowGrowthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {selectedMarketWeeklyTotal.wowGrowthPct === null ? 'N/A' : `${selectedMarketWeeklyTotal.wowGrowthPct > 0 ? '+' : ''}${selectedMarketWeeklyTotal.wowGrowthPct.toFixed(1)}%`}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-500">N/A</td>
                  <td className="px-2 py-2 text-right text-slate-500">N/A</td>
                  <td className="px-2 py-2 text-right text-slate-500">N/A</td>
                </tr>
              ) : null}
              {filteredWeeklyBenchmarkRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-slate-500" colSpan={10}>No weekly benchmark rows for selected market group.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
