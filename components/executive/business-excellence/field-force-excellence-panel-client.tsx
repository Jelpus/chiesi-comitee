'use client';

import { useMemo, useState } from 'react';
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
import type { BusinessExcellenceFieldForceExcellenceData } from '@/types/business-excellence';

function formatPeriodTag(value: string | null | undefined) {
  if (!value) return 'N/A';
  const raw = String(value).trim();
  if (!raw) return 'N/A';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
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
  const objectiveTolerance = 0.2;
  const objectiveMinPct = (1 - objectiveTolerance) * 100;
  const objectiveMaxPct = (1 + objectiveTolerance) * 100;
  const [activeView, setActiveView] = useState<'ytd' | 'mth'>(initialView);
  const [activeCoverage, setActiveCoverage] = useState<'base' | 'adjusted'>(initialCoverage);
  const [activeBu, setActiveBu] = useState<'total' | 'air' | 'care'>(initialBu);
  const [activeDetailMode, setActiveDetailMode] = useState<'territory' | 'district'>(initialDetailMode);
  const [activePotential, setActivePotential] = useState<string>(initialPotential || 'all');
  const [activeInteractionChannel, setActiveInteractionChannel] = useState<string>('all');

  const periodScope = activeView === 'ytd' ? 'YTD' : 'MTH';
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const totalRow = rows.find((row) => row.bu === 'total') ?? rows[0] ?? null;
  const summaryRows = (data?.summaryRows ?? []).filter((row) => row.periodScope === periodScope);
  const doctorRowsScope = (data?.doctorDetailRows ?? []).filter((row) => row.periodScope === periodScope);
  const interactionMixRowsScope = (data?.interactionMixRows ?? []).filter((row) => row.periodScope === periodScope);

  const toLabel = (bu: 'total' | 'air' | 'care') => (bu === 'total' ? 'Total' : bu === 'air' ? 'Air' : 'Care');
  const showPct = (value: number | null | undefined) => (value == null ? 'N/A' : `${value.toFixed(1)}%`);
  const showNumber = (value: number | null | undefined, digits = 0) =>
    value == null
      ? 'N/A'
      : new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

  const selectedCoveragePct =
    activeView === 'ytd'
      ? (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedYtdPct : totalRow?.coverageYtdPct)
      : (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedMthPct : totalRow?.coverageMthPct);
  const selectedTarget =
    activeView === 'ytd'
      ? (activeCoverage === 'adjusted' ? totalRow?.targetVisitsAdjustedYtd : totalRow?.targetVisitsYtd)
      : (activeCoverage === 'adjusted' ? totalRow?.targetVisitsAdjustedMth : totalRow?.targetVisitsMth);
  const totalCoveragePct =
    activeView === 'ytd'
      ? (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedYtdPct : totalRow?.coverageYtdPct)
      : (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedMthPct : totalRow?.coverageMthPct);


  const detailRows = useMemo(() => {
    const filtered = summaryRows.filter(
      (row) =>
        row.aggregationLevel === activeDetailMode
        && (activeBu === 'total' ? row.bu !== 'total' : row.bu === activeBu),
    );
    const map = new Map<string, { label: string; clients: number; objetivoBase: number; objetivoAdjusted: number; interacciones: number }>();
    for (const row of filtered) {
      const label = activeDetailMode === 'territory'
        ? (row.territoryName ?? row.territoryNormalized ?? 'N/A')
        : (row.district ?? 'N/A');
      const key = label.trim().toLowerCase();
      const current = map.get(key) ?? { label, clients: 0, objetivoBase: 0, objetivoAdjusted: 0, interacciones: 0 };
      current.clients += row.clients;
      current.objetivoBase += row.objetivoBase;
      current.objetivoAdjusted += row.objetivoAdjusted;
      current.interacciones += row.interacciones;
      map.set(key, current);
    }
    return Array.from(map.values()).map((row) => {
      const objetivo = activeCoverage === 'adjusted' ? row.objetivoAdjusted : row.objetivoBase;
      return { ...row, objetivo, coberturaPct: objetivo > 0 ? (row.interacciones / objetivo) * 100 : null };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [summaryRows, activeDetailMode, activeBu, activeCoverage]);

  const buFilteredDoctors = doctorRowsScope.filter((row) => activeBu === 'total' || row.bu === activeBu);
  const potentialOptions = useMemo(
    () => Array.from(new Set(buFilteredDoctors.map((row) => (row.potencial ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [buFilteredDoctors],
  );
  const doctorsFilteredByPotential = buFilteredDoctors.filter((row) => activePotential === 'all'
    || (row.potencial ?? '').trim().toLowerCase() === activePotential.toLowerCase());

  const interactionChannelOptions = useMemo(() => {
    const filtered = interactionMixRowsScope.filter((row) => activeBu === 'total' || row.bu === activeBu);
    return Array.from(new Set(filtered.map((row) => (row.channel || 'Unknown').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }, [interactionMixRowsScope, activeBu]);
  const selectedInteractionChannel = interactionChannelOptions.includes(activeInteractionChannel)
    ? activeInteractionChannel
    : 'all';

  const interactionMixChart = useMemo(() => {
    const filtered = interactionMixRowsScope.filter((row) =>
      (activeBu === 'total' || row.bu === activeBu)
      && (selectedInteractionChannel === 'all' || row.channel === selectedInteractionChannel),
    );
    const visitTypeTotals = new Map<string, { interactions: number; channel: string }>();
    for (const row of filtered) {
      const key = row.visitType || 'Unknown';
      const current = visitTypeTotals.get(key) ?? {
        interactions: 0,
        channel: selectedInteractionChannel === 'all' ? 'All Channels' : selectedInteractionChannel,
      };
      current.interactions += row.interactions;
      visitTypeTotals.set(key, current);
    }
    const dataRows = Array.from(visitTypeTotals.entries())
      .map(([visitType, value]) => ({
        visitType: visitType.length > 30 ? `${visitType.slice(0, 30)}...` : visitType,
        fullVisitType: visitType,
        channel: value.channel,
        interactions: value.interactions,
      }))
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 12);
    return dataRows;
  }, [interactionMixRowsScope, activeBu, selectedInteractionChannel]);

  const clientsAggregated = useMemo(() => {
    const map = new Map<
      string,
      {
        clientName: string;
        potencial: string | null;
        objetivoBase: number;
        objetivoAdjusted: number;
        interacciones: number;
      }
    >();
    for (const row of doctorsFilteredByPotential) {
      const clientName = (row.clientName ?? row.doctorId).trim();
      const key = clientName.toLowerCase();
      const current = map.get(key) ?? {
        clientName,
        potencial: row.potencial ?? null,
        objetivoBase: 0,
        objetivoAdjusted: 0,
        interacciones: 0,
      };
      current.objetivoBase += row.objetivoBase;
      current.objetivoAdjusted += row.objetivoAdjusted;
      current.interacciones += row.interacciones;
      if (!current.potencial && row.potencial) current.potencial = row.potencial;
      map.set(key, current);
    }
    return Array.from(map.values());
  }, [doctorsFilteredByPotential]);

  const overvisitedTop = clientsAggregated
    .filter((row) => row.interacciones > row.objetivoBase)
    .sort((a, b) => (b.interacciones - b.objetivoBase) - (a.interacciones - a.objetivoBase))
    .slice(0, 20);

  const subvisitedTop = clientsAggregated
    .filter((row) => row.interacciones > 0 && row.interacciones < row.objetivoBase)
    .sort((a, b) => (b.objetivoBase - b.interacciones) - (a.objetivoBase - a.interacciones))
    .slice(0, 20);

  const noVisitedRows = clientsAggregated
    .filter((row) => row.interacciones === 0)
    .sort((a, b) => a.clientName.localeCompare(b.clientName))
    .slice(0, 200);

  const buChartData = (() => {
    const totalCoverage =
      activeView === 'ytd'
        ? (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedYtdPct : totalRow?.coverageYtdPct)
        : (activeCoverage === 'adjusted' ? totalRow?.coverageAdjustedMthPct : totalRow?.coverageMthPct);
    return rows.map((row) => {
      const coverage =
        activeView === 'ytd'
          ? (activeCoverage === 'adjusted' ? row.coverageAdjustedYtdPct : row.coverageYtdPct)
          : (activeCoverage === 'adjusted' ? row.coverageAdjustedMthPct : row.coverageMthPct);
      const ei =
        row.bu === 'total'
          ? 100
          : coverage != null && totalCoverage != null && totalCoverage !== 0
            ? Math.round((coverage / totalCoverage) * 100)
            : null;
      return {
        bu: row.bu === 'total' ? 'Total' : row.bu === 'air' ? 'Air' : 'Care',
        coverage: coverage ?? 0,
        ei: ei ?? 0,
      };
    });
  })();

  const opportunityData = useMemo(() => {
    return [...detailRows]
      .map((row) => ({
        fullLabel: row.label,
        label: row.label.length > 26 ? `${row.label.slice(0, 26)}...` : row.label,
        objetivo: row.objetivo,
        interacciones: row.interacciones,
        gap: Math.max(0, row.objetivo - row.interacciones),
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10);
  }, [detailRows]);

  const statusMixData = useMemo(() => {
    const objectiveByMode = (item: { objetivoBase: number; objetivoAdjusted: number }) =>
      activeCoverage === 'adjusted' ? item.objetivoAdjusted : item.objetivoBase;
    let noVisitado = 0;
    let subvisitado = 0;
    let enObjetivo = 0;
    let sobrevisitado = 0;
    for (const row of clientsAggregated) {
      const objetivo = objectiveByMode(row);
      if (row.interacciones === 0) {
        noVisitado += 1;
        continue;
      }
      if (objetivo <= 0) {
        sobrevisitado += 1;
        continue;
      }
      const ratio = row.interacciones / objetivo;
      if (ratio < (1 - objectiveTolerance)) subvisitado += 1;
      else if (ratio <= (1 + objectiveTolerance)) enObjetivo += 1;
      else sobrevisitado += 1;
    }
    return [
      { name: 'No visitado', value: noVisitado, color: '#94a3b8' },
      { name: 'Subvisitado', value: subvisitado, color: '#f59e0b' },
      { name: 'En objetivo', value: enObjetivo, color: '#10b981' },
      { name: 'Sobrevisitado', value: sobrevisitado, color: '#2563eb' },
    ].filter((item) => item.value > 0);
  }, [clientsAggregated, activeCoverage, objectiveTolerance]);

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
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Coverage Mode</span>
        <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
          <button type="button" onClick={() => setActiveCoverage('base')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeCoverage === 'base' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Coverage Base</button>
          <button type="button" onClick={() => setActiveCoverage('adjusted')} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${activeCoverage === 'adjusted' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Coverage TFT</button>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 text-base text-slate-700">
        <p><span className="font-medium text-slate-900">Report Period:</span> {formatPeriodTag(data?.reportPeriodMonth ?? null)}</p>
        <p className="mt-1"><span className="font-medium text-slate-900">Effective As Of:</span> {formatPeriodTag(data?.effectiveAsOfMonth ?? null)}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-[14px] border border-slate-200 bg-white p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500"># Clients</p><p className="mt-1 text-2xl font-semibold text-slate-950">{showNumber(totalRow?.portfolioAccounts ?? 0)}</p></article>
        <article className="rounded-[14px] border border-slate-200 bg-white p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500"># Objective</p><p className="mt-1 text-2xl font-semibold text-slate-950">{showNumber(selectedTarget ?? 0)}</p></article>
        <article className="rounded-[14px] border border-slate-200 bg-white p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500"># Interactions</p><p className="mt-1 text-2xl font-semibold text-slate-950">{activeView === 'ytd' ? showNumber(totalRow?.sentInteractionsYtd ?? 0) : showNumber(totalRow?.sentInteractionsMth ?? 0)}</p></article>
        <article className="rounded-[14px] border border-slate-200 bg-white p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">Coverage</p><p className="mt-1 text-2xl font-semibold text-slate-950">{showPct(selectedCoveragePct)}</p></article>
        <article className="rounded-[14px] border border-slate-200 bg-white p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">% Active Time</p><p className="mt-1 text-2xl font-semibold text-slate-950">{activeView === 'ytd' ? showPct(totalRow && totalRow.workingDaysYtd > 0 ? (totalRow.effectiveDaysYtd / totalRow.workingDaysYtd) * 100 : null) : showPct(totalRow && totalRow.workingDaysMth > 0 ? (totalRow.effectiveDaysMth / totalRow.workingDaysMth) * 100 : null)}</p></article>
      </div>

      <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">BU</th><th className="px-3 py-2 text-right"># Clients</th><th className="px-3 py-2 text-right"># Objective</th><th className="px-3 py-2 text-right"># Interactions</th><th className="px-3 py-2 text-right">Coverage</th><th className="px-3 py-2 text-right">EI</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.bu}>
                {(() => {
                  const rowCoveragePct = activeView === 'ytd'
                    ? (activeCoverage === 'adjusted' ? row.coverageAdjustedYtdPct : row.coverageYtdPct)
                    : (activeCoverage === 'adjusted' ? row.coverageAdjustedMthPct : row.coverageMthPct);
                  const ei =
                    row.bu === 'total'
                      ? 100
                      : rowCoveragePct != null && totalCoveragePct != null && totalCoveragePct !== 0
                        ? Math.round((rowCoveragePct / totalCoveragePct) * 100)
                        : null;
                  return (
                    <>
                <td className="px-3 py-2 font-semibold text-slate-900">{toLabel(row.bu)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.portfolioAccounts)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{activeView === 'ytd' ? showNumber(activeCoverage === 'adjusted' ? row.targetVisitsAdjustedYtd : row.targetVisitsYtd) : showNumber(activeCoverage === 'adjusted' ? row.targetVisitsAdjustedMth : row.targetVisitsMth)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{activeView === 'ytd' ? showNumber(row.sentInteractionsYtd) : showNumber(row.sentInteractionsMth)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{activeView === 'ytd' ? showPct(activeCoverage === 'adjusted' ? row.coverageAdjustedYtdPct : row.coverageYtdPct) : showPct(activeCoverage === 'adjusted' ? row.coverageAdjustedMthPct : row.coverageMthPct)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{ei == null ? 'N/A' : ei}</td>
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
          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bu" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="coverage" name="Coverage %" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="ei" name="EI" fill="#1e293b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[16px] border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            Medical Status Mix
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            En objetivo se clasifica con banda {showNumber(objectiveMinPct, 0)}%-{showNumber(objectiveMaxPct, 0)}%.
          </p>
          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusMixData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                  {statusMixData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [showNumber(value, 0), name]}
                  contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
                  labelFormatter={() => `Criterio: En objetivo = ${showNumber(objectiveMinPct, 0)}%-${showNumber(objectiveMaxPct, 0)}%`}
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
        <div className="mt-3 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={opportunityData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => showNumber(value, 0)}
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

      <article className="mt-6 rounded-[18px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Detalle Por BU</p>
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
          </div>
        </div>
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
                {interactionChannelOptions.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
              </select>
            </div>
          </div>
          <div className="h-[320px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={interactionMixChart} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="visitType" width={180} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [showNumber(value, 0), 'Interactions']}
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
            <thead className="bg-slate-50"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">{activeDetailMode === 'territory' ? 'Territory' : 'District'}</th><th className="px-3 py-2 text-right"># Clients</th><th className="px-3 py-2 text-right"># Objective</th><th className="px-3 py-2 text-right"># Interactions</th><th className="px-3 py-2 text-right">Coverage</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {detailRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.clients)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.objetivo)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showNumber(row.interacciones)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{showPct(row.coberturaPct)}</td>
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
              <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50/70"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2 text-right">Objetivo</th><th className="px-3 py-2 text-right">Interacciones</th><th className="px-3 py-2 text-right">Cobertura</th></tr></thead><tbody className="divide-y divide-slate-100">{overvisitedTop.map((row) => <tr key={row.clientName}><td className="px-3 py-2 font-semibold text-slate-900">{row.clientName}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(activeCoverage === 'adjusted' ? row.objetivoAdjusted : row.objetivoBase)}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.interacciones)}</td><td className="px-3 py-2 text-right text-slate-700">{showPct((activeCoverage === 'adjusted' ? row.objetivoAdjusted : row.objetivoBase) > 0 ? (row.interacciones / (activeCoverage === 'adjusted' ? row.objetivoAdjusted : row.objetivoBase)) * 100 : null)}</td></tr>)}</tbody></table>
            </div>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Top 20 Clientes Subvisitados</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50/70"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2 text-right">Objetivo</th><th className="px-3 py-2 text-right">Interacciones</th><th className="px-3 py-2 text-right">Cobertura</th></tr></thead><tbody className="divide-y divide-slate-100">{subvisitedTop.map((row) => <tr key={row.clientName}><td className="px-3 py-2 font-semibold text-slate-900">{row.clientName}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(activeCoverage === 'adjusted' ? row.objetivoAdjusted : row.objetivoBase)}</td><td className="px-3 py-2 text-right text-slate-700">{showNumber(row.interacciones)}</td><td className="px-3 py-2 text-right text-slate-700">{showPct((activeCoverage === 'adjusted' ? row.objetivoAdjusted : row.objetivoBase) > 0 ? (row.interacciones / (activeCoverage === 'adjusted' ? row.objetivoAdjusted : row.objetivoBase)) * 100 : null)}</td></tr>)}</tbody></table>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Clientes No Visitados En Fichero</div>
          <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/70"><tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Potencial</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {noVisitedRows.map((row) => <tr key={row.clientName}><td className="px-3 py-2 font-semibold text-slate-900">{row.clientName}</td><td className="px-3 py-2 text-slate-700">{row.potencial ?? 'N/A'}</td></tr>)}
            </tbody>
          </table>
          </div>
        </div>
      </article>
    </article>
  );
}

