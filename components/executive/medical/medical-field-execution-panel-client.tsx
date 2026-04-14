'use client';

import { useMemo, useState } from 'react';
import type { MedicalMslDashboardData, MedicalMslDashboardRow } from '@/lib/data/medical';

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function formatInteger(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

type Props = {
  data: MedicalMslDashboardData | null;
};

export function MedicalFieldExecutionPanelClient({ data }: Props) {
  const [activeView, setActiveView] = useState<'ytd' | 'mth'>('ytd');
  const scope: 'YTD' | 'MTH' = activeView === 'mth' ? 'MTH' : 'YTD';

  const scopeRows = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((row) => row.periodScope === scope)
        .sort((a, b) => {
          const aName = `${a.mlsCode} ${a.mlsName ?? ''}`.trim();
          const bName = `${b.mlsCode} ${b.mlsName ?? ''}`.trim();
          return aName.localeCompare(bName);
        }),
    [data?.rows, scope],
  );

  const scopeSummary =
    scope === 'MTH'
      ? (data?.summary.mth ?? null)
      : (data?.summary.ytd ?? null);

  const topCoverage = [...scopeRows]
    .sort((a, b) => (b.coveragePct ?? -1) - (a.coveragePct ?? -1))
    .slice(0, 5);
  const lowReach = [...scopeRows]
    .sort((a, b) => (a.reachPct ?? 999) - (b.reachPct ?? 999))
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <article className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Medical Field Force Add-on</p>
        <p className="mt-1 text-sm text-slate-700">
          Additional operational view by MLS (BU = Medical): fixed target of 40 interactions per month per MLS, plus Reach over assigned clients.
        </p>
      </article>

      <article className="rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Medical Field Execution</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">BU = Medical | Dimension = MLS</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveView('ytd')}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeView === 'ytd' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              YTD
            </button>
            <button
              type="button"
              onClick={() => setActiveView('mth')}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeView === 'mth' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              MTH
            </button>
          </div>
        </div>
      </article>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">MLS</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatInteger(scopeSummary?.totalMls ?? 0)}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Clients</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatInteger(scopeSummary?.clients ?? 0)}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Interactions</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatInteger(scopeSummary?.interactions ?? 0)}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Target</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatInteger(scopeSummary?.target ?? 0)}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Coverage</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatPercent(scopeSummary?.coveragePct ?? null)}</p>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Reach</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatPercent(scopeSummary?.reachPct ?? null)}</p>
          <p className="mt-1 text-xs text-slate-600">{formatInteger(scopeSummary?.uniqueClientsReached ?? 0)} unique reached</p>
        </article>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Top Coverage MLS</p>
          <div className="mt-2 space-y-2">
            {topCoverage.map((row: MedicalMslDashboardRow) => (
              <div key={`cov-${row.periodScope}-${row.mlsCode}`} className="rounded-[10px] border border-slate-200 bg-slate-50/60 p-2">
                <p className="text-sm font-semibold text-slate-900">{row.mlsCode}{row.mlsName ? ` - ${row.mlsName}` : ''}</p>
                <p className="text-xs text-slate-700">
                  Interactions {formatInteger(row.interactions)} / Target {formatInteger(row.target)} ({formatPercent(row.coveragePct)})
                </p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-[18px] border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Low Reach MLS</p>
          <div className="mt-2 space-y-2">
            {lowReach.map((row: MedicalMslDashboardRow) => (
              <div key={`reach-${row.periodScope}-${row.mlsCode}`} className="rounded-[10px] border border-slate-200 bg-slate-50/60 p-2">
                <p className="text-sm font-semibold text-slate-900">{row.mlsCode}{row.mlsName ? ` - ${row.mlsName}` : ''}</p>
                <p className="text-xs text-slate-700">
                  Unique reached {formatInteger(row.uniqueClientsReached)} / Clients {formatInteger(row.clients)} ({formatPercent(row.reachPct)})
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3">MLS</th>
                <th className="px-4 py-3 text-right">Clients</th>
                <th className="px-4 py-3 text-right">Interactions</th>
                <th className="px-4 py-3 text-right">Target</th>
                <th className="px-4 py-3 text-right">Coverage</th>
                <th className="px-4 py-3 text-right">Unique Clients Reached</th>
                <th className="px-4 py-3 text-right">Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopeRows.map((row) => (
                <tr key={`${row.periodScope}-${row.mlsCode}`}>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.mlsCode}{row.mlsName ? ` - ${row.mlsName}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatInteger(row.clients)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatInteger(row.interactions)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatInteger(row.target)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatPercent(row.coveragePct)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatInteger(row.uniqueClientsReached)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatPercent(row.reachPct)}</td>
                </tr>
              ))}
              {scopeRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                    No Medical Salesforce data found for this reporting cut.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

