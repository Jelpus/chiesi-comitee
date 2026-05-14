'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HumanResourcesOpenVacancyData, HumanResourcesOpenVacancyDetailRow } from '@/types/human-resources';

type OpeningFilter = 'all' | 'existing' | 'new';
type StatusFilter = 'all' | 'open' | 'closed' | 'paused' | 'about_to_enter' | 'other';

const openingOptions: Array<{ value: OpeningFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'existing', label: 'Existent' },
  { value: 'new', label: 'New' },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'about_to_enter', label: 'About to enter' },
  { value: 'paused', label: 'Paused' },
  { value: 'other', label: 'Other' },
];

function formatInt(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null) {
  if (value == null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDays(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)} days`;
}

function formatTooltipValue(value: unknown, name: unknown) {
  const numeric = Number(value);
  const label = String(name ?? '');
  if (!Number.isFinite(numeric)) return ['N/A', label];
  if (label === 'Avg TTF') return [formatDays(numeric), label];
  return [formatInt(numeric), label];
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(value: string | null | undefined) {
  const date = parseDateOnly(value);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function monthLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}

function formatShortDate(value: string | null | undefined) {
  const date = parseDateOnly(value);
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
}

function businessDaysBetween(startValue: string | null | undefined, endDate = new Date()) {
  const startDate = parseDateOnly(startValue);
  if (!startDate) return null;
  const endUtc = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));
  if (startDate > endUtc) return 0;

  let count = 0;
  const cursor = new Date(startDate);
  while (cursor <= endUtc) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function openingBucket(row: HumanResourcesOpenVacancyDetailRow): OpeningFilter | 'other' {
  const value = normalizeText(row.openingType);
  if (value.includes('exist')) return 'existing';
  if (value.includes('new') || value.includes('nuev')) return 'new';
  return 'other';
}

function statusBucket(row: HumanResourcesOpenVacancyDetailRow): StatusFilter {
  const value = normalizeText(row.status);
  if (value.includes('pausa') || value.includes('pause')) return 'paused';
  if (value.includes('por entrar') || value.includes('about to enter')) return 'about_to_enter';
  if (value.includes('abiert') || value.includes('open')) return 'open';
  if (value.includes('cubiert') || value.includes('cerrad') || value.includes('closed') || value.includes('filled')) return 'closed';
  if (row.hireDate || row.endDate) return 'closed';
  return 'other';
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function KpiHelp({ text }: { text: string }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-500" title={text}>
      ?
    </span>
  );
}

function KpiLabel({ children, help }: { children: ReactNode; help: string }) {
  return (
    <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
      <span>{children}</span>
      <KpiHelp text={help} />
    </p>
  );
}

function StatusLegend() {
  const items = [
    { label: 'Open', className: 'bg-emerald-500' },
    { label: 'Closed', className: 'bg-slate-500' },
    { label: 'About to enter', className: 'bg-cyan-500' },
    { label: 'Paused', className: 'bg-amber-500' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

type BreakdownRow = {
  label: string;
  opened: number;
  open: number;
  covered: number;
  paused: number;
  aboutToEnter: number;
  avgTimeToFillDays: number | null;
  targetHitRate: number | null;
};

function buildBreakdown(rows: HumanResourcesOpenVacancyDetailRow[], getLabel: (row: HumanResourcesOpenVacancyDetailRow) => string | null | undefined) {
  const groups = new Map<string, HumanResourcesOpenVacancyDetailRow[]>();
  for (const row of rows) {
    const label = (getLabel(row) ?? 'Unassigned').trim() || 'Unassigned';
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  return Array.from(groups.entries())
    .map(([label, group]): BreakdownRow => {
      const measured = group.filter((row) => row.timeToFillDays != null && row.targetDays != null);
      return {
        label,
        opened: group.length,
        open: group.filter((row) => statusBucket(row) === 'open').length,
        covered: group.filter((row) => statusBucket(row) === 'closed').length,
        paused: group.filter((row) => statusBucket(row) === 'paused').length,
        aboutToEnter: group.filter((row) => statusBucket(row) === 'about_to_enter').length,
        avgTimeToFillDays: average(group.map((row) => row.timeToFillDays).filter((value): value is number => value != null)),
        targetHitRate: measured.length === 0 ? null : measured.filter((row) => (row.timeToFillDays ?? 0) <= (row.targetDays ?? 0)).length / measured.length,
      };
    })
    .sort((a, b) => b.opened - a.opened);
}

function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const maxOpened = Math.max(1, ...rows.map((row) => row.opened));
  return (
    <article className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? <p className="text-sm text-slate-500">No open vacancy data available.</p> : null}
        {rows.map((row) => (
          <div key={`${title}-${row.label}`} className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
              <p className="text-xs text-slate-600">{formatInt(row.opened)} total</p>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-200" style={{ width: `${Math.max(8, (row.opened / maxOpened) * 100)}%` }}>
              <div className="h-full bg-emerald-500" style={{ width: `${row.opened > 0 ? (row.open / row.opened) * 100 : 0}%` }} />
              <div className="h-full bg-slate-500" style={{ width: `${row.opened > 0 ? (row.covered / row.opened) * 100 : 0}%` }} />
              <div className="h-full bg-cyan-500" style={{ width: `${row.opened > 0 ? (row.aboutToEnter / row.opened) * 100 : 0}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${row.opened > 0 ? (row.paused / row.opened) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Open {formatInt(row.open)} | Closed {formatInt(row.covered)} | About to enter {formatInt(row.aboutToEnter)} | Paused {formatInt(row.paused)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Avg TTF {formatDays(row.avgTimeToFillDays)} | In target {formatPercent(row.targetHitRate)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function OpenVacancyPanelClient({ data }: { data: HumanResourcesOpenVacancyData }) {
  const [openingFilter, setOpeningFilter] = useState<OpeningFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const reportMonth = data.overview?.reportPeriodMonth ?? null;

  const rowsByOpening = useMemo(
    () => data.details.filter((row) => openingFilter === 'all' || openingBucket(row) === openingFilter),
    [data.details, openingFilter],
  );
  const detailRows = useMemo(
    () => rowsByOpening.filter((row) => statusFilter === 'all' || statusBucket(row) === statusFilter),
    [rowsByOpening, statusFilter],
  );
  const measuredRows = rowsByOpening.filter((row) => row.timeToFillDays != null && row.targetDays != null);
  const overview = {
    ytdOpened: rowsByOpening.length,
    openMth: rowsByOpening.filter((row) => monthKey(row.searchStartDate) === reportMonth && statusBucket(row) === 'open').length,
    closedMth: rowsByOpening.filter((row) => monthKey(row.searchStartDate) === reportMonth && statusBucket(row) === 'closed').length,
    aboutToEnterMth: rowsByOpening.filter((row) => monthKey(row.searchStartDate) === reportMonth && statusBucket(row) === 'about_to_enter').length,
    pausedMth: rowsByOpening.filter((row) => monthKey(row.searchStartDate) === reportMonth && statusBucket(row) === 'paused').length,
    avgTimeToFillDays: average(rowsByOpening.map((row) => row.timeToFillDays).filter((value): value is number => value != null)),
    targetHitRate: measuredRows.length === 0 ? null : measuredRows.filter((row) => (row.timeToFillDays ?? 0) <= (row.targetDays ?? 0)).length / measuredRows.length,
  };
  const monthlyTrend = useMemo(() => {
    const groups = new Map<string, HumanResourcesOpenVacancyDetailRow[]>();
    for (const row of rowsByOpening) {
      const key = monthKey(row.searchStartDate);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, group]) => ({
        key,
        label: monthLabel(key),
        opened: group.length,
        open: group.filter((row) => statusBucket(row) === 'open').length,
        covered: group.filter((row) => statusBucket(row) === 'closed').length,
        paused: group.filter((row) => statusBucket(row) === 'paused').length,
        aboutToEnter: group.filter((row) => statusBucket(row) === 'about_to_enter').length,
        avgTimeToFillDays: average(group.map((row) => row.timeToFillDays).filter((value): value is number => value != null)),
      }));
  }, [rowsByOpening]);
  const monthlyChartRows = useMemo(
    () =>
      monthlyTrend.map((row) => ({
        label: row.label,
        open: row.open,
        closed: row.covered,
        aboutToEnter: row.aboutToEnter,
        paused: row.paused,
        avgTtf: row.avgTimeToFillDays,
      })),
    [monthlyTrend],
  );
  const byArea = useMemo(() => buildBreakdown(rowsByOpening, (row) => row.area), [rowsByOpening]);
  const byType = useMemo(() => buildBreakdown(rowsByOpening, (row) => row.vacancyType), [rowsByOpening]);

  return (
    <div className="space-y-4">
      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Open Vacancy Scorecard</p>
          <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1">
            {openingOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setOpeningFilter(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                  openingFilter === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions opened year to date using Fecha inicio busqueda as period month.">YTD Opened</KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview.ytdOpened)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions with status Open in the current report month.">Open MTH</KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview.openMth)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions with status Closed in the current report month.">Closed MTH</KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview.closedMth)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions about to enter in the current report month.">About to enter MTH</KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview.aboutToEnterMth)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Positions temporarily paused in the current report month.">Paused MTH</KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatInt(overview.pausedMth)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Average Time to Fill read directly from the Excel column.">Avg Time to Fill</KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatDays(overview.avgTimeToFillDays)}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
            <KpiLabel help="Share of measured vacancies at or below target: FF 35 days, Staff 45 days.">In Target</KpiLabel>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(overview.targetHitRate)}</p>
          </div>
        </div>
      </article>

      <article className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Monthly Flow</p>
          <StatusLegend />
        </div>
        {monthlyChartRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No monthly vacancy trend available.</p>
        ) : (
          <div className="mt-3 h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart data={monthlyChartRows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis
                  yAxisId="ttf"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  width={42}
                />
                <Tooltip formatter={formatTooltipValue} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="count" dataKey="open" name="Open" stackId="status" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="closed" name="Closed" stackId="status" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="aboutToEnter" name="About to enter" stackId="status" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="paused" name="Paused" stackId="status" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="ttf"
                  type="monotone"
                  dataKey="avgTtf"
                  name="Avg TTF"
                  stroke="#111827"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>

      <div className="rounded-[16px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Status Composition</p>
          <StatusLegend />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownTable title="By Area" rows={byArea} />
        <BreakdownTable title="By Type" rows={byType} />
      </div>

      <article className="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Latest Vacancy Detail</p>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-white">
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2">View</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Resp HR</th>
                <th className="px-3 py-2 text-right">TTF</th>
                <th className="px-3 py-2 text-right">Target</th>
                <th className="px-3 py-2">Start</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detailRows.map((row, index) => {
                const elapsedBusinessDays = row.timeToFillDays == null ? businessDaysBetween(row.searchStartDate) : null;
                return (
                  <tr key={`${row.area}-${row.manager}-${row.searchStartDate}-${index}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.status ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.area ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.openingType ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.vacancyType ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.manager ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.respHr ?? 'N/A'}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.withinTarget === false ? 'text-rose-700' : row.timeToFillDays == null ? 'text-amber-700' : 'text-slate-900'}`}>
                      {row.timeToFillDays == null
                        ? (elapsedBusinessDays == null ? 'N/A' : `${elapsedBusinessDays}*`)
                        : row.timeToFillDays.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.targetDays == null ? 'N/A' : row.targetDays.toFixed(0)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatShortDate(row.searchStartDate)}</td>
                  </tr>
                );
              })}
              {detailRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={9}>No open vacancy records available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          * Provisional business days elapsed from Start to today for vacancies without final Time to Fill in the source file.
        </p>
      </article>
    </div>
  );
}
