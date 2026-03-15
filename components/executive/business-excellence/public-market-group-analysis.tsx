'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type {
  BusinessExcellencePublicDimensionRankingRow,
  BusinessExcellencePublicMarketChartPoint,
  BusinessExcellencePublicMarketTopProductRow,
} from '@/types/business-excellence';

type PublicMarketGroupAnalysisProps = {
  rows: BusinessExcellencePublicMarketTopProductRow[];
  chartRows: BusinessExcellencePublicMarketChartPoint[];
  rankingRows: BusinessExcellencePublicDimensionRankingRow[];
};

function formatPercent(value: number | null, digits = 1) {
  if (value === null) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function toneByValue(value: number | null, threshold = 0) {
  if (value === null) return 'text-slate-500';
  if (value >= threshold) return 'text-emerald-700';
  return 'text-rose-700';
}

function safeMarketUnits(chiesiUnits: number, msPct: number | null) {
  if (msPct === null || msPct <= 0) return 0;
  return chiesiUnits / (msPct / 100);
}

function formatShortMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(date);
}

export function PublicMarketGroupAnalysis({ rows, chartRows, rankingRows }: PublicMarketGroupAnalysisProps) {
  const [windowMode, setWindowMode] = useState<'ytd' | 'mth'>('ytd');
  const [dataScope, setDataScope] = useState<'all' | 'chiesi'>('chiesi');
  const [rankingMode, setRankingMode] = useState<'clue' | 'clave' | 'ruta'>('clue');

  const marketGroups = useMemo(
    () => Array.from(new Set(rows.map((row) => row.marketGroup ?? 'No Market'))).sort(),
    [rows],
  );

  const [selectedMarketGroup, setSelectedMarketGroup] = useState(marketGroups[0] ?? '');

  const selectedRow = useMemo(
    () => rows.find((row) => (row.marketGroup ?? 'No Market') === selectedMarketGroup) ?? null,
    [rows, selectedMarketGroup],
  );

  const detail = useMemo(() => {
    if (!selectedRow) return null;

    const chiesiUnits = windowMode === 'ytd' ? selectedRow.ytdPieces : selectedRow.mthPieces;
    const chiesiUnitsPy = windowMode === 'ytd' ? selectedRow.ytdPiecesPy : selectedRow.mthPiecesPy;
    const chiesiGrowthPct = windowMode === 'ytd' ? selectedRow.ytdGrowthPct : selectedRow.mthGrowthPct;
    const msPct = windowMode === 'ytd' ? selectedRow.ytdMsPct : selectedRow.mthMsPct;
    const msPctPy = windowMode === 'ytd' ? selectedRow.ytdMsPctPy : selectedRow.mthMsPctPy;
    const ei = windowMode === 'ytd' ? selectedRow.ytdEvolutionIndex : selectedRow.mthEvolutionIndex;
    const budgetUnits = windowMode === 'ytd' ? selectedRow.ytdBudgetUnits : selectedRow.mthBudgetUnits;
    const coveragePct = windowMode === 'ytd' ? selectedRow.ytdCoverageVsBudgetPct : selectedRow.mthCoverageVsBudgetPct;

    const marketUnits = safeMarketUnits(chiesiUnits, msPct);
    const marketUnitsPy = safeMarketUnits(chiesiUnitsPy, msPctPy);
    const marketGrowthPct =
      marketUnitsPy > 0 ? ((marketUnits - marketUnitsPy) / marketUnitsPy) * 100 : null;

    const units = dataScope === 'chiesi' ? chiesiUnits : marketUnits;
    const unitsPy = dataScope === 'chiesi' ? chiesiUnitsPy : marketUnitsPy;
    const growthPct = dataScope === 'chiesi' ? chiesiGrowthPct : marketGrowthPct;

    return {
      brandName: selectedRow.brandName,
      units,
      unitsPy,
      growthPct,
      msPct: dataScope === 'chiesi' ? msPct : 100,
      ei: dataScope === 'chiesi' ? ei : null,
      budgetUnits: dataScope === 'chiesi' ? budgetUnits : 0,
      coveragePct: dataScope === 'chiesi' ? coveragePct : null,
    };
  }, [selectedRow, windowMode, dataScope]);

  const trendRows = useMemo(
    () =>
      chartRows
        .filter((row) => row.marketGroup === selectedMarketGroup && row.scope === dataScope)
        .map((row) => ({
          ...row,
          periodLabel: formatShortMonth(row.periodMonth),
        }))
        .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth)),
    [chartRows, selectedMarketGroup, dataScope],
  );

  const rankingDisplayRows = useMemo(
    () =>
      rankingRows
        .filter(
          (row) =>
            row.marketGroup === selectedMarketGroup &&
            row.scope === dataScope &&
            row.dimension === rankingMode,
        )
        .sort((a, b) => b.ytdUnits - a.ytdUnits)
        .slice(0, 30),
    [rankingRows, selectedMarketGroup, dataScope, rankingMode],
  );

  if (rows.length === 0) return null;

  return (
    <div className="mt-4 space-y-4 rounded-[18px] border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Market Group</span>
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
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Data Scope</span>
          <select
            value={dataScope}
            onChange={(event) => setDataScope(event.target.value as 'all' | 'chiesi')}
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="chiesi">Chiesi Only</option>
            <option value="all">All Market</option>
          </select>
        </label>

        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setWindowMode('ytd')}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              windowMode === 'ytd' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            YTD
          </button>
          <button
            type="button"
            onClick={() => setWindowMode('mth')}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              windowMode === 'mth' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            MTH
          </button>
        </div>
      </div>

      <div className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          Public Trend (Units)
        </p>
        <div className="mt-3 h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => new Intl.NumberFormat('en-US').format(Number(value ?? 0))}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Line type="monotone" dataKey="units" stroke="#1d4ed8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[16px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          Public Market Group Analysis
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="px-2 py-2">Market Group - Scope</th>
                <th className="px-2 py-2 text-right">Units</th>
                <th className="px-2 py-2 text-right">Units PY</th>
                <th className="px-2 py-2 text-right">Growth vs PY</th>
                <th className="px-2 py-2 text-right">MS% (% of market)</th>
                <th className="px-2 py-2 text-right">Evolution Index</th>
                <th className="px-2 py-2 text-right">Coverage vs Budget (%)</th>
              </tr>
            </thead>
            <tbody>
              {detail ? (
                <tr className="border-b border-slate-100">
                  <td className="px-2 py-2 text-slate-900">
                    <span className="text-slate-500">{selectedMarketGroup}</span>
                    {' - '}
                    {dataScope === 'chiesi' ? detail.brandName : 'All Market'}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-slate-900">
                    {new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(detail.units)}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(detail.unitsPy)}
                  </td>
                  <td className={`px-2 py-2 text-right font-semibold ${toneByValue(detail.growthPct)}`}>
                    {formatPercent(detail.growthPct, 1)}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-900">
                    {detail.msPct === null ? 'N/A' : `${detail.msPct.toFixed(1)}%`}
                  </td>
                  <td className={`px-2 py-2 text-right font-semibold ${toneByValue(detail.ei, 100)}`}>
                    {detail.ei === null ? 'N/A' : detail.ei}
                  </td>
                  <td className={`px-2 py-2 text-right font-semibold ${toneByValue(detail.coveragePct, 100)}`}>
                    {detail.coveragePct === null ? 'N/A' : `${detail.coveragePct.toFixed(1)}%`}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td className="px-2 py-2 text-slate-500" colSpan={7}>No rows available for selected market group.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Ranking Mode</p>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            {(
              [
                { key: 'clave', label: 'CLAVE' },
                { key: 'ruta', label: 'RUTA' },
                { key: 'clue', label: 'CLUE' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRankingMode(item.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                  rankingMode === item.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 max-h-[260px] overflow-auto scrollbar-none rounded-[12px] border border-slate-200">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700">
                  {rankingMode.toUpperCase()}
                </th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">YTD Units</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">YTD PY Units</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold text-slate-700">Growth vs PY</th>
              </tr>
            </thead>
            <tbody>
              {rankingDisplayRows.map((row) => (
                <tr key={`${row.dimension}-${row.label}`} className="border-b border-slate-100 last:border-b-0">
                  <td className="max-w-[360px] truncate px-2 py-1.5 text-slate-800">{row.label}</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-slate-900">
                    {new Intl.NumberFormat('en-US').format(row.ytdUnits)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-700">
                    {new Intl.NumberFormat('en-US').format(row.ytdPyUnits)}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${toneByValue(row.growthVsPyPct)}`}>
                    {row.growthVsPyPct === null ? 'N/A' : formatPercent(row.growthVsPyPct, 1)}
                  </td>
                </tr>
              ))}
              {rankingDisplayRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-slate-500" colSpan={4}>No ranking data for selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
