'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Info, Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  BusinessExcellenceFieldForceDetailData,
  BusinessExcellenceFieldForceExcellenceData,
} from '@/types/business-excellence';

function formatPeriodTag(value: string | null | undefined) {
  if (!value) return 'N/A';
  const raw = String(value).trim();
  if (!raw) return 'N/A';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function MetricCard({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span title={tooltip} className="inline-flex text-slate-400">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{tooltip}</span>
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </article>
  );
}

type Props = {
  data: BusinessExcellenceFieldForceExcellenceData | null;
  initialView: 'ytd' | 'mth';
  initialCoverage: 'base' | 'adjusted';
  initialBu: 'total' | 'air' | 'care';
  initialDetailMode: 'territory' | 'district';
  initialPotential: string;
};

export function FieldForceExcellencePanelClient({
  data,
  initialView,
  initialCoverage,
  initialBu,
  initialDetailMode,
  initialPotential,
}: Props) {
  const [activeView, setActiveView] = useState<'ytd' | 'mth'>(initialView);
  const [activeCoverage, setActiveCoverage] = useState<'base' | 'adjusted'>(initialCoverage);
  const [activeBu, setActiveBu] = useState<'total' | 'air' | 'care'>(initialBu);
  const [activeDetailMode, setActiveDetailMode] = useState<'territory' | 'district'>(initialDetailMode);
  const [activePotential, setActivePotential] = useState<string>(initialPotential && initialPotential !== 'all' ? initialPotential : 'all');
  const [activeInteractionChannel, setActiveInteractionChannel] = useState<string>('all');
  const [activeAccountTypes, setActiveAccountTypes] = useState<string[]>([]);
  const [accountTypeMenuOpen, setAccountTypeMenuOpen] = useState(false);
  const [detailData, setDetailData] = useState<BusinessExcellenceFieldForceDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const totalRow = rows.find((row) => row.bu === 'total') ?? rows[0] ?? null;

  const toLabel = (bu: 'total' | 'air' | 'care') => (bu === 'total' ? 'Total' : bu === 'air' ? 'Air' : 'Care');
  const showPct = (value: number | null | undefined) => (value == null ? 'N/A' : `${value.toFixed(1)}%`);
  const showNumber = (value: number | null | undefined, digits = 0) =>
    value == null
      ? 'N/A'
      : new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const toNumericValue = (value: unknown) => {
    const raw = Array.isArray(value) ? value[0] : value;
      const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num) ? num : null;
  };
  const potentialOptions = ['P1', 'P2', 'P3', 'Otros'];

  const selectedCoveragePct =
    activeView === 'ytd'
      ? (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedYtdPct : totalRow?.coverageYtdPct)
      : (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedMthPct : totalRow?.coverageMthPct);
  const selectedFrequencyPct =
    activeView === 'ytd'
      ? (activeCoverage === 'adjusted' ? totalRow?.inFrequencyAdjustedYtdPct : totalRow?.inFrequencyYtdPct)
      : (activeCoverage === 'adjusted' ? totalRow?.inFrequencyAdjustedMthPct : totalRow?.inFrequencyMthPct);
  const selectedClients =
    activeView === 'ytd'
      ? (totalRow?.portfolioAccountsYtd ?? totalRow?.portfolioAccounts)
      : (totalRow?.portfolioAccountsMth ?? totalRow?.portfolioAccounts);

  const cpdBase =
    activeView === 'ytd'
      ? (totalRow && totalRow.workingDaysYtd > 0 ? totalRow.sentInteractionsYtd / totalRow.workingDaysYtd : null)
      : (totalRow && totalRow.workingDaysMth > 0 ? totalRow.sentInteractionsMth / totalRow.workingDaysMth : null);
  const cpdAdjusted =
    activeView === 'ytd'
      ? (totalRow && totalRow.effectiveDaysYtd > 0 ? totalRow.sentInteractionsYtd / totalRow.effectiveDaysYtd : null)
      : (totalRow && totalRow.effectiveDaysMth > 0 ? totalRow.sentInteractionsMth / totalRow.effectiveDaysMth : null);
  const selectedCpd = activeCoverage === 'adjusted' ? cpdAdjusted : cpdBase;
  const selectedEffectiveTime =
    activeView === 'ytd'
      ? (totalRow && totalRow.workingDaysYtd > 0 ? (totalRow.effectiveDaysYtd / totalRow.workingDaysYtd) * 100 : null)
      : (totalRow && totalRow.workingDaysMth > 0 ? (totalRow.effectiveDaysMth / totalRow.workingDaysMth) * 100 : null);

  useEffect(() => {
    if (!data?.reportingVersionId || !data.reportPeriodMonth) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      reportingVersionId: data.reportingVersionId,
      reportPeriodMonth: data.reportPeriodMonth,
      view: activeView,
      coverage: activeCoverage,
      bu: activeBu,
      detailMode: activeDetailMode,
      potential: activePotential,
      channel: activeInteractionChannel,
    });
    activeAccountTypes.forEach((accountType) => params.append('accountTypes', accountType));

    void Promise.resolve().then(() => {
      setDetailLoading(true);
      setDetailError(null);

      return fetch(`/api/executive/business-excellence/field-force/detail?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { ok?: boolean; data?: BusinessExcellenceFieldForceDetailData; error?: string };
          if (!response.ok || !payload.ok || !payload.data) {
            throw new Error(payload.error ?? 'Unable to load Field Force detail.');
          }
          setDetailData(payload.data);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setDetailError(error instanceof Error ? error.message : 'Unable to load Field Force detail.');
          setDetailData(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    });

    return () => controller.abort();
  }, [
    data?.reportingVersionId,
    data?.reportPeriodMonth,
    activeView,
    activeCoverage,
    activeBu,
    activeDetailMode,
    activePotential,
    activeInteractionChannel,
    activeAccountTypes,
  ]);

  const channelOptions = useMemo(() => detailData?.channelOptions ?? [], [detailData?.channelOptions]);
  const accountTypeOptions = useMemo(() => detailData?.accountTypeOptions ?? [], [detailData?.accountTypeOptions]);
  const selectedAccountTypeLabel =
    activeAccountTypes.length === 0
      ? 'All Account Types'
      : activeAccountTypes.length === 1
        ? activeAccountTypes[0]
        : `${activeAccountTypes.length} Account Types`;
  const toggleAccountType = (accountType: string) => {
    setActiveAccountTypes((current) =>
      current.includes(accountType)
        ? current.filter((item) => item !== accountType)
        : [...current, accountType],
    );
    setActiveInteractionChannel('all');
  };
  const selectedInteractionChannel = channelOptions.includes(activeInteractionChannel)
    ? activeInteractionChannel
    : 'all';
  const detailRows = detailData?.detailRows ?? [];
  const interactionMixChart = detailData?.interactionMixChart ?? [];
  const overvisitedTop = detailData?.overvisitedTop ?? [];
  const subvisitedTop = detailData?.subvisitedTop ?? [];
  const noVisitedRows = detailData?.noVisitedRows ?? [];
  const opportunityData = detailData?.opportunityData ?? [];
  const statusMixData = detailData?.statusMixData ?? [];

  const buChartData = (() => {
    return rows.map((row) => {
      const coverage =
        activeView === 'ytd'
          ? (activeCoverage === 'adjusted' ? row.coverageAdjustedYtdPct : row.coverageYtdPct)
          : (activeCoverage === 'adjusted' ? row.coverageAdjustedMthPct : row.coverageMthPct);
      const frequency =
        activeView === 'ytd'
          ? (activeCoverage === 'adjusted' ? row.inFrequencyAdjustedYtdPct : row.inFrequencyYtdPct)
          : (activeCoverage === 'adjusted' ? row.inFrequencyAdjustedMthPct : row.inFrequencyMthPct);
      const workingDays = activeView === 'ytd' ? row.workingDaysYtd : row.workingDaysMth;
      const effectiveDays = activeView === 'ytd' ? row.effectiveDaysYtd : row.effectiveDaysMth;
      const interactions = activeView === 'ytd' ? row.sentInteractionsYtd : row.sentInteractionsMth;
      return {
        bu: row.bu === 'total' ? 'Total' : row.bu === 'air' ? 'Air' : 'Care',
        coverage: coverage ?? 0,
        frequency: frequency ?? 0,
        cpd: (activeCoverage === 'adjusted' ? effectiveDays : workingDays) > 0
          ? interactions / (activeCoverage === 'adjusted' ? effectiveDays : workingDays)
          : 0,
        effectiveTime: workingDays > 0 ? (effectiveDays / workingDays) * 100 : 0,
      };
    });
  })();

  return (
    <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Field Force Excellence</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Field Force Effectiveness</h2>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
          <button type="button" onClick={() => setActiveView('ytd')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeView === 'ytd' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>YTD</button>
          <button type="button" onClick={() => setActiveView('mth')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeView === 'mth' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>MTH</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Calculation Base</span>
        <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
          <button type="button" onClick={() => setActiveCoverage('base')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeCoverage === 'base' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Base</button>
          <button type="button" onClick={() => setActiveCoverage('adjusted')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeCoverage === 'adjusted' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>TFT</button>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 text-base text-slate-700">
        <p><span className="font-medium text-slate-900">Report Period:</span> {formatPeriodTag(data?.reportPeriodMonth ?? null)}</p>
        <p className="mt-1"><span className="font-medium text-slate-900">Effective As Of:</span> {formatPeriodTag(data?.effectiveAsOfMonth ?? null)}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total Unique Clients" value={showNumber(selectedClients ?? 0)} tooltip="Medicos unicos activos en el fichero filtrado para el alcance MTH/YTD." />
        <MetricCard label="Total Interactions" value={activeView === 'ytd' ? showNumber(totalRow?.sentInteractionsYtd ?? 0) : showNumber(totalRow?.sentInteractionsMth ?? 0)} tooltip="Interacciones distintas asociadas a medicos del fichero activo." />
        <MetricCard label="Global Coverage" value={showPct(selectedCoveragePct)} tooltip="Medicos con al menos una interaccion dividido entre medicos unicos del fichero." />
        <MetricCard label="In Frequency Rate" value={showPct(selectedFrequencyPct)} tooltip="Medicos que cumplen interacciones >= objetivo. En TFT usa objetivo ajustado por tiempo efectivo." />
        <MetricCard label="Average CPD" value={showNumber(selectedCpd, 2)} tooltip="Calls per day: interacciones divididas entre dias estandar o dias efectivos si TFT esta activo." />
        <MetricCard label="Effective Time" value={showPct(selectedEffectiveTime)} tooltip="Dias efectivos despues de descontar TFT sobre dias estandar." />
      </div>

      <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">BU</th><th className="px-3 py-2 text-right">Unique Clients</th><th className="px-3 py-2 text-right">Total Interactions</th><th className="px-3 py-2 text-right">Coverage</th><th className="px-3 py-2 text-right">In Frequency</th><th className="px-3 py-2 text-right">CPD</th><th className="px-3 py-2 text-right">Effective Time</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.bu}>
                {(() => {
                  const rowCoveragePct = activeView === 'ytd'
                    ? (activeCoverage === 'adjusted' ? row.coverageAdjustedYtdPct : row.coverageYtdPct)
                    : (activeCoverage === 'adjusted' ? row.coverageAdjustedMthPct : row.coverageMthPct);
                  const rowFrequencyPct = activeView === 'ytd'
                    ? (activeCoverage === 'adjusted' ? row.inFrequencyAdjustedYtdPct : row.inFrequencyYtdPct)
                    : (activeCoverage === 'adjusted' ? row.inFrequencyAdjustedMthPct : row.inFrequencyMthPct);
                  const rowWorkingDays = activeView === 'ytd' ? row.workingDaysYtd : row.workingDaysMth;
                  const rowEffectiveDays = activeView === 'ytd' ? row.effectiveDaysYtd : row.effectiveDaysMth;
                  const rowInteractions = activeView === 'ytd' ? row.sentInteractionsYtd : row.sentInteractionsMth;
                  const rowCpd = (activeCoverage === 'adjusted' ? rowEffectiveDays : rowWorkingDays) > 0
                    ? rowInteractions / (activeCoverage === 'adjusted' ? rowEffectiveDays : rowWorkingDays)
                    : null;
                  return (
                    <>
                <td className="px-3 py-2 font-semibold text-slate-900">{toLabel(row.bu)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{activeView === 'ytd' ? showNumber(row.portfolioAccountsYtd ?? row.portfolioAccounts) : showNumber(row.portfolioAccountsMth ?? row.portfolioAccounts)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{showNumber(rowInteractions)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{showPct(rowCoveragePct)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{showPct(rowFrequencyPct)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{showNumber(rowCpd, 2)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{showPct(rowWorkingDays > 0 ? (rowEffectiveDays / rowWorkingDays) * 100 : null)}</td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <article className="rounded-[16px] border border-slate-200 bg-white p-3 xl:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            BU Performance Snapshot
          </p>
          <div className="mt-3 h-[280px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={buChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bu" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="coverage" name="Coverage %" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="left" dataKey="frequency" name="In Frequency %" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="cpd" name="CPD" fill="#1e293b" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="left" dataKey="effectiveTime" name="Effective Time %" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[16px] border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            Medical Status Mix
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            In Frequency usa interacciones mayores o iguales al objetivo activo.
          </p>
          <div className="mt-3 h-[280px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={statusMixData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                  {statusMixData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [showNumber(toNumericValue(value), 0), String(name)]}
                  contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
                  labelFormatter={() => `Criterio: interacciones >= objetivo ${activeCoverage === 'adjusted' ? 'TFT' : 'base'}`}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="mt-4 rounded-[16px] border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          Opportunity Gap By {activeDetailMode === 'territory' ? 'Territory' : 'District'}
        </p>
        <div className="mt-3 h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={opportunityData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => showNumber(toNumericValue(value), 0)}
                labelFormatter={(value, payload) => {
                  const item = payload?.[0]?.payload as
                    | { fullLabel?: string; objetivo?: number; interacciones?: number; gap?: number }
                    | undefined;
                  if (!item) return String(value);
                  return `${item.fullLabel ?? value} | Objetivo: ${showNumber(item.objetivo, 0)} | Interacciones: ${showNumber(item.interacciones, 0)} | Gap: ${showNumber(item.gap, 0)}`;
                }}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
              />
              <Bar dataKey="gap" name="Objective Gap" fill="#f97316" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="relative mt-6 rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Visit Detail</p>
            {detailLoading && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Loading
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
              {(['total', 'air', 'care'] as const).map((bu) => (
                <button key={bu} type="button" onClick={() => setActiveBu(bu)} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeBu === bu ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{toLabel(bu)}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
              <button type="button" onClick={() => setActiveDetailMode('territory')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeDetailMode === 'territory' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Territory</button>
              <button type="button" onClick={() => setActiveDetailMode('district')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeDetailMode === 'district' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>District</button>
            </div>
            <select value={activePotential} onChange={(e) => setActivePotential(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
              <option value="all">All Potencial</option>
              {potentialOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountTypeMenuOpen((open) => !open)}
                className="inline-flex min-h-[32px] max-w-[300px] items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 shadow-sm"
              >
                <span className="truncate">{selectedAccountTypeLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${accountTypeMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {accountTypeMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Account Type</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAccountTypes([]);
                        setActiveInteractionChannel('all');
                      }}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-950"
                    >
                      All
                    </button>
                  </div>
                  <div className="max-h-[260px] overflow-auto py-1">
                    {accountTypeOptions.map((accountType) => {
                      const selected = activeAccountTypes.includes(accountType);
                      return (
                        <button
                          key={accountType}
                          type="button"
                          onClick={() => toggleAccountType(accountType)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                            selected ? 'bg-slate-50 text-slate-950' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-transparent'
                          }`}>
                            <Check className="h-3 w-3" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{accountType}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {(detailLoading || detailError) && (
          <div className={`mt-3 rounded-[10px] border px-3 py-2 text-sm ${
            detailError
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}>
            {detailError ?? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading Field Force detail...
              </span>
            )}
          </div>
        )}
        <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              Interactions Mix: Visit Type
            </p>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Channel</label>
              <select
                value={selectedInteractionChannel}
                onChange={(e) => setActiveInteractionChannel(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All</option>
                {channelOptions.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
              </select>
            </div>
          </div>
          <div className="h-[320px] min-w-0 p-3">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={interactionMixChart} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="visitType" width={180} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [showNumber(toNumericValue(value), 0), 'Interactions']}
                  labelFormatter={(value, payload) => {
                    const item = payload?.[0]?.payload as { fullVisitType?: string; channel?: string } | undefined;
                    if (!item) return String(value);
                    return `${item.fullVisitType ?? value} | Channel: ${item.channel ?? 'All'}`;
                  }}
                  contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
                />
                <Bar dataKey="interactions" name="Interactions" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
          <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2">{activeDetailMode === 'territory' ? 'Territory' : 'District'}</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right">Unique Clients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right"># Interactions</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right">Effective Days</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right">Visit Coverage</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right">In Frequency</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right">CPD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detailRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.clients)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.interacciones)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.effectiveDays, 1)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showPct(row.visitCoveragePct)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showPct(row.inFrequencyRatePct)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.cpd, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </article>

      <article className="mt-6 rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Analisis De Medicos ({toLabel(activeBu)})</p>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Potencial</label>
            <select value={activePotential} onChange={(e) => setActivePotential(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700">
              <option value="all">All</option>
              {potentialOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[14px] border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Top 20 Clientes Sobrevisitados</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50/70"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Territory</th><th className="px-3 py-2">Potencial</th><th className="px-3 py-2 text-right">Objetivo</th><th className="px-3 py-2 text-right">Interacciones</th><th className="px-3 py-2 text-right">Diff</th></tr></thead><tbody className="divide-y divide-slate-100">{overvisitedTop.map((row) => <tr key={`${row.doctorId}-${row.territory}`}><td className="px-3 py-2 font-semibold text-slate-900">{row.clientName}</td><td className="px-3 py-2 text-slate-700">{row.territory}</td><td className="px-3 py-2 text-slate-700">{row.potencial ?? 'N/A'}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.objective)}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.interacciones)}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.difference, 1)}</td></tr>)}</tbody></table>
            </div>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Top 20 Clientes Subvisitados</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50/70"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Territory</th><th className="px-3 py-2">Potencial</th><th className="px-3 py-2 text-right">Objetivo</th><th className="px-3 py-2 text-right">Interacciones</th><th className="px-3 py-2 text-right">Gap</th></tr></thead><tbody className="divide-y divide-slate-100">{subvisitedTop.map((row) => <tr key={`${row.doctorId}-${row.territory}`}><td className="px-3 py-2 font-semibold text-slate-900">{row.clientName}</td><td className="px-3 py-2 text-slate-700">{row.territory}</td><td className="px-3 py-2 text-slate-700">{row.potencial ?? 'N/A'}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.objective)}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.interacciones)}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.gap, 1)}</td></tr>)}</tbody></table>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Clientes No Visitados En Fichero</div>
          <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/70"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Territory</th><th className="px-3 py-2">District</th><th className="px-3 py-2">BU</th><th className="px-3 py-2">Potencial</th><th className="px-3 py-2 text-right">Objetivo</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {noVisitedRows.map((row) => <tr key={`${row.doctorId}-${row.territory}`}><td className="px-3 py-2 font-semibold text-slate-900">{row.clientName}</td><td className="px-3 py-2 text-slate-700">{row.territory}</td><td className="px-3 py-2 text-slate-700">{row.district}</td><td className="px-3 py-2 text-slate-700">{row.bu.toUpperCase()}</td><td className="px-3 py-2 text-slate-700">{row.potencial ?? 'N/A'}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.objective)}</td></tr>)}
            </tbody>
          </table>
          </div>
        </div>
      </article>
    </article>
  );
}

