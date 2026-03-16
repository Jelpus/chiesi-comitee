'use client';

import { useMemo, useState } from 'react';
import type { OpexRow } from '@/lib/data/opex';

type OpexDashboardPanelProps = {
  rows: OpexRow[];
};

type PeriodMode = 'ytd' | 'mth';
type ScopeMode = 'total' | 'without_rare';

const RARE_EXCLUDED_CECOS = new Set([
  'r&d rare disease',
  'knowledgerd',
  'medical affairs rd',
  'business knowledgerd',
  'rare',
  'market access rd',
]);

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatAmount(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatSignedPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function getMetricYear(metricName: string): number | null {
  const match = metricName.match(/(\d{4})$/);
  if (!match) return null;
  return Number(match[1]);
}

function resolveMetricMap(rows: OpexRow[]) {
  const metrics = [...new Set(rows.map((row) => row.metricName))];
  const actualMetrics = metrics.filter((metric) => metric.startsWith('actuals_'));
  const budgetMetrics = metrics.filter((metric) => metric.startsWith('budget_'));

  const actualSorted = actualMetrics
    .map((metric) => ({ metric, year: getMetricYear(metric) ?? -1 }))
    .sort((a, b) => b.year - a.year);

  const currentActual = actualSorted[0]?.metric ?? null;
  const pyActual = actualSorted[1]?.metric ?? null;
  const currentYear = getMetricYear(currentActual ?? '');
  const budgetForCurrent = budgetMetrics.find((metric) => getMetricYear(metric) === currentYear) ?? null;

  return { currentActual, pyActual, budgetForCurrent, currentYear };
}

function getBudgetTone(coverage: number | null): {
  label: string;
  className: string;
} {
  if (coverage == null) {
    return { label: 'No Target', className: 'border-slate-300 bg-slate-50 text-slate-700' };
  }
  if (coverage >= 105) {
    return { label: 'Above Plan', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
  }
  if (coverage >= 100) {
    return { label: 'On Plan+', className: 'border-teal-300 bg-teal-50 text-teal-800' };
  }
  if (coverage >= 95) {
    return { label: 'Near Plan', className: 'border-amber-300 bg-amber-50 text-amber-800' };
  }
  return { label: 'Below Plan', className: 'border-rose-300 bg-rose-50 text-rose-800' };
}

export function OpexDashboardPanel({ rows }: OpexDashboardPanelProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('ytd');
  const [scopeMode, setScopeMode] = useState<ScopeMode>('total');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedCecoName, setSelectedCecoName] = useState<string>('');

  const metricMap = useMemo(() => resolveMetricMap(rows), [rows]);

  const groupTable = useMemo(() => {
    const byGroup = new Map<string, { actual: number; budget: number; py: number }>();
    for (const row of rows) {
      const inScope =
        scopeMode === 'total' || !RARE_EXCLUDED_CECOS.has(normalize(row.cecoName));
      if (!inScope) continue;

      const cecoNameGroup = (row.cecoNameGroup ?? '').trim() || 'Ungrouped';
      const current = byGroup.get(cecoNameGroup) ?? { actual: 0, budget: 0, py: 0 };
      const isCurrentPeriod = periodMode === 'ytd' ? row.isYtd : row.isMth;
      const isPyPeriod = periodMode === 'ytd' ? row.isYtdPy : row.isMthPy;

      if (metricMap.currentActual && row.metricName === metricMap.currentActual && isCurrentPeriod) {
        current.actual += row.amountValue;
      }
      if (metricMap.budgetForCurrent && row.metricName === metricMap.budgetForCurrent && isCurrentPeriod) {
        current.budget += row.amountValue;
      }
      if (metricMap.pyActual && row.metricName === metricMap.pyActual && isPyPeriod) {
        current.py += row.amountValue;
      }

      byGroup.set(cecoNameGroup, current);
    }

    return [...byGroup.entries()]
      .map(([cecoNameGroup, values]) => ({
        cecoNameGroup,
        actual: values.actual,
        budget: values.budget,
        py: values.py,
        budgetCoveragePct: values.budget > 0 ? (values.actual / values.budget) * 100 : null,
        vsPyPct: values.py > 0 ? ((values.actual - values.py) / values.py) * 100 : null,
      }))
      .sort((a, b) => b.actual - a.actual);
  }, [rows, scopeMode, periodMode, metricMap]);

  const totals = useMemo(() => {
    const actual = groupTable.reduce((sum, row) => sum + row.actual, 0);
    const budget = groupTable.reduce((sum, row) => sum + row.budget, 0);
    const py = groupTable.reduce((sum, row) => sum + row.py, 0);
    const budgetCoveragePct = budget > 0 ? (actual / budget) * 100 : null;
    const vsPyPct = py > 0 ? ((actual - py) / py) * 100 : null;
    return { actual, budget, py, budgetCoveragePct, vsPyPct };
  }, [groupTable]);

  const groupOptions = groupTable.map((row) => row.cecoNameGroup);
  const effectiveGroup = groupOptions.includes(selectedGroup) ? selectedGroup : (groupOptions[0] ?? 'Ungrouped');

  const detailByCeco = (() => {
    const byItem = new Map<string, { actual: number; budget: number; py: number }>();
    for (const row of rows) {
      const inScope =
        scopeMode === 'total' || !RARE_EXCLUDED_CECOS.has(normalize(row.cecoName));
      if (!inScope) continue;
      const cecoGroup = (row.cecoNameGroup ?? '').trim() || 'Ungrouped';
      if (cecoGroup !== effectiveGroup) continue;

      const item = (row.cecoName ?? '').trim() || 'Unassigned CeCo';
      const current = byItem.get(item) ?? { actual: 0, budget: 0, py: 0 };
      const isCurrentPeriod = periodMode === 'ytd' ? row.isYtd : row.isMth;
      const isPyPeriod = periodMode === 'ytd' ? row.isYtdPy : row.isMthPy;

      if (metricMap.currentActual && row.metricName === metricMap.currentActual && isCurrentPeriod) {
        current.actual += row.amountValue;
      }
      if (metricMap.budgetForCurrent && row.metricName === metricMap.budgetForCurrent && isCurrentPeriod) {
        current.budget += row.amountValue;
      }
      if (metricMap.pyActual && row.metricName === metricMap.pyActual && isPyPeriod) {
        current.py += row.amountValue;
      }
      byItem.set(item, current);
    }
    return [...byItem.entries()]
      .map(([name, values]) => ({
        name,
        actual: values.actual,
        budget: values.budget,
        budgetCoveragePct: values.budget > 0 ? (values.actual / values.budget) * 100 : null,
        vsPyPct: values.py > 0 ? ((values.actual - values.py) / values.py) * 100 : null,
      }))
      .filter((row) => !(row.actual === 0 && row.budget === 0))
      .sort((a, b) => b.actual - a.actual);
  })();

  const effectiveSelectedCecoName = detailByCeco.some((row) => row.name === selectedCecoName)
    ? selectedCecoName
    : (detailByCeco[0]?.name ?? '');

  const detailByElement = (() => {
    const byItem = new Map<string, { actual: number; budget: number; py: number }>();
    for (const row of rows) {
      const inScope =
        scopeMode === 'total' || !RARE_EXCLUDED_CECOS.has(normalize(row.cecoName));
      if (!inScope) continue;
      const cecoGroup = (row.cecoNameGroup ?? '').trim() || 'Ungrouped';
      if (cecoGroup !== effectiveGroup) continue;
      const cecoName = (row.cecoName ?? '').trim() || 'Unassigned CeCo';
      if (cecoName !== effectiveSelectedCecoName) continue;

      const item = (row.element ?? '').trim() || 'Unassigned Element';
      const current = byItem.get(item) ?? { actual: 0, budget: 0, py: 0 };
      const isCurrentPeriod = periodMode === 'ytd' ? row.isYtd : row.isMth;
      const isPyPeriod = periodMode === 'ytd' ? row.isYtdPy : row.isMthPy;

      if (metricMap.currentActual && row.metricName === metricMap.currentActual && isCurrentPeriod) {
        current.actual += row.amountValue;
      }
      if (metricMap.budgetForCurrent && row.metricName === metricMap.budgetForCurrent && isCurrentPeriod) {
        current.budget += row.amountValue;
      }
      if (metricMap.pyActual && row.metricName === metricMap.pyActual && isPyPeriod) {
        current.py += row.amountValue;
      }
      byItem.set(item, current);
    }
    return [...byItem.entries()]
      .map(([name, values]) => ({
        name,
        actual: values.actual,
        budget: values.budget,
        budgetCoveragePct: values.budget > 0 ? (values.actual / values.budget) * 100 : null,
        vsPyPct: values.py > 0 ? ((values.actual - values.py) / values.py) * 100 : null,
      }))
      .filter((row) => !(row.actual === 0 && row.budget === 0))
      .sort((a, b) => b.actual - a.actual);
  })();

  const executionRatePct = useMemo(() => {
    if (periodMode !== 'ytd' || !metricMap.budgetForCurrent || metricMap.currentYear == null) return null;
    let ytdActual = 0;
    let fyBudget = 0;
    for (const row of rows) {
      const inScope =
        scopeMode === 'total' || !RARE_EXCLUDED_CECOS.has(normalize(row.cecoName));
      if (!inScope) continue;
      if (metricMap.currentActual && row.metricName === metricMap.currentActual && row.isYtd) {
        ytdActual += row.amountValue;
      }
      const rowYear = row.periodMonth ? Number(row.periodMonth.slice(0, 4)) : null;
      if (row.metricName === metricMap.budgetForCurrent && rowYear === metricMap.currentYear) {
        fyBudget += row.amountValue;
      }
    }
    if (fyBudget <= 0) return null;
    return (ytdActual / fyBudget) * 100;
  }, [rows, scopeMode, periodMode, metricMap]);

  const totalChartScaleMax = Math.max(1, totals.py, totals.actual, totals.budget);

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Opex Expense Monitor</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              CeCoGroup Performance
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Actual vs Budget vs PY grouped by <span className="font-semibold">ceco_name_group</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
              {(['ytd', 'mth'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    periodMode === mode ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
              {([
                ['total', 'Total'],
                ['without_rare', 'w/o Rare'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScopeMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    scopeMode === mode ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Market Co Expenses</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatAmount(totals.actual)}</p>
            <p className="text-xs text-slate-600">{periodMode.toUpperCase()} actual</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Budget</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatAmount(totals.budget)}</p>
            <p className="text-xs text-slate-600">{periodMode.toUpperCase()} budget</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Budget Coverage</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(totals.budgetCoveragePct)}</p>
            <p className="text-xs text-slate-600">Actual / Budget</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Vs PY</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatSignedPercent(totals.vsPyPct)}</p>
            <p className="text-xs text-slate-600">Growth vs prior year</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Execution Rate</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(executionRatePct)}</p>
            <p className="text-xs text-slate-600">
              {periodMode === 'ytd' ? 'YTD Actual / FY Budget' : 'Only for YTD view'}
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">CeCo Ranking (By Group)</p>
        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">CeCo Group</th>
                  <th className="px-3 py-2 text-right">Actual</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Budget Coverage</th>
                  <th className="px-3 py-2 text-right">Vs PY</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupTable.map((row) => {
                  const tone = getBudgetTone(row.budgetCoveragePct);
                  return (
                    <tr key={row.cecoNameGroup}>
                      <td className="px-3 py-2 text-left font-medium text-slate-800">{row.cecoNameGroup}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatAmount(row.actual)}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatAmount(row.budget)}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatPercent(row.budgetCoveragePct)}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatSignedPercent(row.vsPyPct)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone.className}`}>
                          {tone.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {groupTable.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-center text-slate-500" colSpan={6}>
                      No OPEX rows available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">PY vs Actual vs Budget</p>
            <p className="mt-1 text-xs text-slate-600">Total comparison ({periodMode.toUpperCase()})</p>
            <div className="mt-4 flex h-56 items-end justify-around gap-6 rounded-[10px] border border-slate-200 bg-white p-4">
              {[
                { label: 'PY', value: totals.py, color: 'bg-slate-400' },
                { label: 'Actual', value: totals.actual, color: 'bg-blue-500' },
                { label: 'Budget', value: totals.budget, color: 'bg-amber-500' },
              ].map((bar) => (
                <div key={bar.label} className="flex w-24 flex-col items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-600">{formatAmount(bar.value)}</span>
                  <div className="flex h-36 w-10 items-end rounded bg-slate-100">
                    <div
                      className={`w-full rounded-t ${bar.color}`}
                      style={{ height: `${Math.max(4, (bar.value / totalChartScaleMax) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">CeCo Detail By Group</p>
          <div className="flex items-center gap-2">
            <label htmlFor="opex-group-select" className="text-xs uppercase tracking-[0.12em] text-slate-500">
              CeCoGroup
            </label>
            <select
              id="opex-group-select"
              value={effectiveGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700"
            >
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
            <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Ranking by CeCo Name
            </p>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">CeCo Name</th>
                  <th className="px-3 py-2 text-right">Actual</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailByCeco.map((row) => (
                  <tr
                    key={row.name}
                    onClick={() => setSelectedCecoName(row.name)}
                    className={`cursor-pointer ${row.name === effectiveSelectedCecoName ? 'bg-blue-50/60' : ''}`}
                  >
                    <td className="px-3 py-2 text-left font-medium text-slate-800">
                      {row.name}
                      {row.name === effectiveSelectedCecoName ? (
                        <span className="ml-2 inline-flex rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-800">
                          Selected
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-900">{formatAmount(row.actual)}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{formatAmount(row.budget)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getBudgetTone(row.budgetCoveragePct).className}`}>
                        {formatPercent(row.budgetCoveragePct)} · {getBudgetTone(row.budgetCoveragePct).label}
                      </span>
                    </td>
                  </tr>
                ))}
                {detailByCeco.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-center text-slate-500" colSpan={4}>
                      No CeCo rows available for {effectiveGroup}.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
            <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Ranking by Element
            </p>
            <p className="border-b border-slate-100 bg-white px-3 py-2 text-[10px] text-slate-600">
              Filtered by CeCo Name: <span className="font-semibold text-slate-800">{effectiveSelectedCecoName || 'N/A'}</span>
            </p>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Element</th>
                  <th className="px-3 py-2 text-right">Actual</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailByElement.map((row) => (
                  <tr key={row.name}>
                    <td className="px-3 py-2 text-left font-medium text-slate-800">{row.name}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{formatAmount(row.actual)}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{formatAmount(row.budget)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getBudgetTone(row.budgetCoveragePct).className}`}>
                        {formatPercent(row.budgetCoveragePct)} · {getBudgetTone(row.budgetCoveragePct).label}
                      </span>
                    </td>
                  </tr>
                ))}
                {detailByElement.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-center text-slate-500" colSpan={4}>
                      No Element rows available for {effectiveSelectedCecoName || effectiveGroup}.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>
  );
}
