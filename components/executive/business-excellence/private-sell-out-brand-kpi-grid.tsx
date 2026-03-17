'use client';

import { useState } from 'react';
import { formatSalesMetric } from '@/lib/format/sales-metric';
import type { BusinessExcellencePrivateSellOutMartRow } from '@/types/business-excellence';

type PrivateSellOutBrandKpiGridProps = {
  rows: BusinessExcellencePrivateSellOutMartRow[];
};

function formatRatioPercent(value: number | null, digits = 1) {
  if (value === null) return 'N/A';
  const percent = value * 100;
  return `${percent.toFixed(digits)}%`;
}

function formatGrowthPercent(value: number | null, digits = 1) {
  if (value === null) return 'vs PY: N/A';
  const percent = value * 100;
  const sign = percent > 0 ? '+' : '';
  return `vs PY: ${sign}${percent.toFixed(digits)}%`;
}

function formatIndex(value: number | null) {
  if (value === null) return 'N/A';
  return value.toFixed(0);
}

function formatRecetas(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function growthTone(value: number | null) {
  if (value === null) return 'text-slate-500';
  if (value >= 0) return 'text-emerald-700';
  if (value >= -5) return 'text-amber-700';
  return 'text-rose-700';
}

function eiTone(value: number | null) {
  if (value === null) return 'text-slate-500';
  if (value >= 100) return 'text-emerald-700';
  return 'text-rose-700';
}

export function PrivateSellOutBrandKpiGrid({ rows }: PrivateSellOutBrandKpiGridProps) {
  const [windowMode, setWindowMode] = useState<'ytd' | 'mth'>('ytd');

  return (
    <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          Brand KPI Grid (vw_private_sellout)
        </p>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setWindowMode('ytd')}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              windowMode === 'ytd' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            YTD
          </button>
          <button
            type="button"
            onClick={() => setWindowMode('mth')}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              windowMode === 'mth' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            MTH
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <th className="px-2 py-2">Market Group - Brand</th>
              <th className="px-2 py-2 text-right">Net Sales</th>
              <th className="px-2 py-2 text-right">Units</th>
              <th className="px-2 py-2 text-right">MS% (% of market)</th>
              <th className="px-2 py-2 text-right">EI</th>
              <th className="px-2 py-2 text-right">Coverage vs Budget (%)</th>
              <th className="px-2 py-2 text-right">Rx</th>
              <th className="px-2 py-2 text-right">Rx MG</th>
              <th className="px-2 py-2 text-right">Rx Neumo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const units = windowMode === 'ytd' ? row.ytdUnits : row.mthUnits;
              const unitsGrowth = windowMode === 'ytd' ? row.growthVsPyYtdUnitsPct : row.growthVsPyMthUnitsPct;
              const ms = windowMode === 'ytd' ? row.msYtdUnitsPct : row.msMthUnitsPct;
              const ei = windowMode === 'ytd' ? row.eiYtdUnits : row.eiMthUnits;
              const netSales = windowMode === 'ytd' ? row.ytdNetSales : row.mthNetSales;
              const rx = windowMode === 'ytd' ? row.ytdRx : row.mthRx;
              const rxGrowth = windowMode === 'ytd' ? row.growthVsPyYtdRxPct : row.growthVsPyMthRxPct;
              const rxMg = windowMode === 'ytd' ? row.ytdRxByMg : row.mthRxByMg;
              const rxNeumo = windowMode === 'ytd' ? row.ytdRxByNeumo : row.mthRxByNeumo;
              const rxMgRatio = windowMode === 'ytd' ? row.ytdRxMgRatio : row.mthRxMgRatio;
              const rxNeumoRatio = windowMode === 'ytd' ? row.ytdRxNeumoRatio : row.mthRxNeumoRatio;
              const budgetUnits = windowMode === 'ytd' ? row.budgetYtdUnits : row.budgetMthUnits;
              const coverage = budgetUnits > 0 ? units / budgetUnits : null;

              return (
                <tr key={`${row.marketGroup ?? 'all'}-${row.brandName}`} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2 font-medium text-slate-900">
                    <span className="text-slate-500">{row.marketGroup ?? 'No Market'}</span> - {row.brandName}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatSalesMetric(netSales, 'currency')}</td>
                  <td className="px-2 py-2 text-right">
                    <p className="font-semibold text-slate-900">{formatSalesMetric(units, 'units')}</p>
                    <p className={`text-xs ${growthTone(unitsGrowth === null ? null : unitsGrowth * 100)}`}>
                      {formatGrowthPercent(unitsGrowth)}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">{formatRatioPercent(ms)}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${eiTone(ei)}`}>{formatIndex(ei)}</td>
                  <td className={`px-2 py-2 text-right font-semibold ${growthTone(coverage === null ? null : (coverage * 100 - 100))}`}>
                    {formatRatioPercent(coverage)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <p className="text-slate-700">{formatRecetas(rx)}</p>
                    <p className={`text-xs ${growthTone(rxGrowth === null ? null : rxGrowth * 100)}`}>
                      {formatGrowthPercent(rxGrowth)}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <p className="text-slate-700">{formatRecetas(rxMg)}</p>
                    <p className="text-xs text-slate-500">{formatRatioPercent(rxMgRatio)} of total Prescriptions</p>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <p className="text-slate-700">{formatRecetas(rxNeumo)}</p>
                    <p className="text-xs text-slate-500">{formatRatioPercent(rxNeumoRatio)} of total Prescriptions</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
