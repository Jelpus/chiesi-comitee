'use client';

import { useState } from 'react';
import { formatSalesMetric } from '@/lib/format/sales-metric';
import type { BusinessExcellencePrivateSellOutMartRow } from '@/types/business-excellence';

type PrivateSellOutBrandKpiGridProps = {
  rows: BusinessExcellencePrivateSellOutMartRow[];
};

const TRIPLES_TOTAL_TRIMBOW_LABEL = 'Triples - Total Trimbow';

function normalizeMarketText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isTriplesDoseMarketGroup(marketGroup: string | null | undefined) {
  const normalized = normalizeMarketText(marketGroup);
  if (!normalized.includes('triples')) return false;
  return normalized.includes('media dosis') || normalized.includes('dosis alta');
}

function isTrimbowBrand(brandName: string | null | undefined) {
  return normalizeMarketText(brandName).includes('trimbow');
}

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
  const triplesRows = rows.filter(
    (row) => isTriplesDoseMarketGroup(row.marketGroup) && isTrimbowBrand(row.brandName),
  );
  const triplesSyntheticRow: BusinessExcellencePrivateSellOutMartRow | null = triplesRows.length
    ? (() => {
        const ytdUnits = triplesRows.reduce((sum, row) => sum + row.ytdUnits, 0);
        const ytdUnitsPy = triplesRows.reduce((sum, row) => sum + row.ytdUnitsPy, 0);
        const mthUnits = triplesRows.reduce((sum, row) => sum + row.mthUnits, 0);
        const mthUnitsPy = triplesRows.reduce((sum, row) => sum + row.mthUnitsPy, 0);
        const ytdNetSales = triplesRows.reduce((sum, row) => sum + row.ytdNetSales, 0);
        const mthNetSales = triplesRows.reduce((sum, row) => sum + row.mthNetSales, 0);
        const ytdRx = triplesRows.reduce((sum, row) => sum + row.ytdRx, 0);
        const mthRx = triplesRows.reduce((sum, row) => sum + row.mthRx, 0);
        const ytdRxByMg = triplesRows.reduce((sum, row) => sum + row.ytdRxByMg, 0);
        const mthRxByMg = triplesRows.reduce((sum, row) => sum + row.mthRxByMg, 0);
        const ytdRxByNeumo = triplesRows.reduce((sum, row) => sum + row.ytdRxByNeumo, 0);
        const mthRxByNeumo = triplesRows.reduce((sum, row) => sum + row.mthRxByNeumo, 0);
        const budgetYtdUnits = triplesRows.reduce((sum, row) => sum + row.budgetYtdUnits, 0);
        const budgetMthUnits = triplesRows.reduce((sum, row) => sum + row.budgetMthUnits, 0);
        const weightedYtdVisitedUnits = triplesRows.reduce(
          (sum, row) => sum + ((row.ytdUnitsVisitedRatio ?? 0) * row.ytdUnits),
          0,
        );
        const weightedMthVisitedUnits = triplesRows.reduce(
          (sum, row) => sum + ((row.mthUnitsVisitedRatio ?? 0) * row.mthUnits),
          0,
        );
        const weightedYtdVisitedRx = triplesRows.reduce(
          (sum, row) => sum + ((row.ytdRxVisitedRatio ?? 0) * row.ytdRx),
          0,
        );
        const weightedMthVisitedRx = triplesRows.reduce(
          (sum, row) => sum + ((row.mthRxVisitedRatio ?? 0) * row.mthRx),
          0,
        );

        return {
          reportingVersionId: triplesRows[0].reportingVersionId,
          marketGroup: TRIPLES_TOTAL_TRIMBOW_LABEL,
          brandName: 'Trimbow',
          lastAvailableMonth: triplesRows[0].lastAvailableMonth,
          ytdUnits,
          ytdUnitsPy,
          growthVsPyYtdUnitsPct: ytdUnitsPy > 0 ? (ytdUnits - ytdUnitsPy) / ytdUnitsPy : null,
          msYtdUnitsPct: null,
          eiYtdUnits: null,
          mthUnits,
          mthUnitsPy,
          growthVsPyMthUnitsPct: mthUnitsPy > 0 ? (mthUnits - mthUnitsPy) / mthUnitsPy : null,
          msMthUnitsPct: null,
          eiMthUnits: null,
          ytdNetSales,
          mthNetSales,
          ytdRx,
          mthRx,
          growthVsPyYtdRxPct: null,
          growthVsPyMthRxPct: null,
          ytdRxByMg,
          mthRxByMg,
          ytdRxByNeumo,
          mthRxByNeumo,
          budgetYtdUnits,
          budgetMthUnits,
          ytdUnitsVisitedRatio: ytdUnits > 0 ? weightedYtdVisitedUnits / ytdUnits : null,
          mthUnitsVisitedRatio: mthUnits > 0 ? weightedMthVisitedUnits / mthUnits : null,
          ytdRxVisitedRatio: ytdRx > 0 ? weightedYtdVisitedRx / ytdRx : null,
          mthRxVisitedRatio: mthRx > 0 ? weightedMthVisitedRx / mthRx : null,
          ytdRxMgRatio: ytdRx > 0 ? ytdRxByMg / ytdRx : null,
          mthRxMgRatio: mthRx > 0 ? mthRxByMg / mthRx : null,
          ytdRxNeumoRatio: ytdRx > 0 ? ytdRxByNeumo / ytdRx : null,
          mthRxNeumoRatio: mthRx > 0 ? mthRxByNeumo / mthRx : null,
          varianceVsBudgetYtdUnitsPct: budgetYtdUnits > 0 ? (ytdUnits - budgetYtdUnits) / budgetYtdUnits : null,
          varianceVsBudgetYtdNetSalesPct: null,
          varianceVsBudgetMthUnitsPct: budgetMthUnits > 0 ? (mthUnits - budgetMthUnits) / budgetMthUnits : null,
          varianceVsBudgetMthNetSalesPct: null,
        };
      })()
    : null;
  const displayRows = triplesSyntheticRow ? [...rows, triplesSyntheticRow] : rows;

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
            {displayRows.map((row) => {
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
