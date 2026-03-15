'use client';

import { useMemo, useState } from 'react';
import { DsoTrendChart } from '@/components/executive/commercial-operations/dso-trend-chart';
import { DsoComparisonBarChart } from '@/components/executive/commercial-operations/dso-comparison-bar-chart';
import type {
  CommercialOperationsDsoOverviewRow,
  CommercialOperationsDsoTrendRow,
  CommercialOperationsStockRow,
} from '@/lib/data/commercial-operations';

type DsoTableRow = {
  groupName: string;
  currentValue: number | null;
  previousMonthValue: number | null;
  momDelta: number | null;
  ytdAvg: number | null;
  ytdAvgPy: number | null;
  ytdAvgDelta: number | null;
  target: number | null;
  variance: number | null;
};

type DsoDashboardPanelProps = {
  overviewRows: CommercialOperationsDsoOverviewRow[];
  trendRows: CommercialOperationsDsoTrendRow[];
  tableRows: DsoTableRow[];
  initialGroup: string;
  stockRows: CommercialOperationsStockRow[];
  stockTargets: {
    totalDays: number | null;
    privateDays: number | null;
    publicDays: number | null;
  };
};

type StockScope = 'total' | 'private' | 'public';

const GROUP_ORDER = ['Anual / General', 'B2B Privado', 'B2C Privado', 'B2C Gobierno', 'B2B Gobierno'];

function normalizeLabel(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function formatDsoValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(1);
}

function toMonthDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toYyyyMmDd(value: Date | null) {
  if (!value) return 'N/A';
  return value.toISOString().slice(0, 10);
}

function subOneMonth(value: Date | null) {
  if (!value) return null;
  const cloned = new Date(value);
  cloned.setUTCMonth(cloned.getUTCMonth() - 1);
  return cloned;
}

function findGroup<T extends { groupName: string }>(rows: T[], groupName: string) {
  const target = normalizeLabel(groupName);
  return rows.find((row) => normalizeLabel(row.groupName) === target) ?? null;
}

function normalizeScopeFromRow(row: CommercialOperationsStockRow): 'private' | 'public' | 'unknown' {
  const text = `${row.businessType ?? ''} ${row.market ?? ''}`.toLowerCase();
  if (text.includes('gobierno') || text.includes('government') || text.includes('public')) return 'public';
  if (text.includes('privado') || text.includes('private')) return 'private';
  return 'unknown';
}

function normalizeStockType(value: string | null | undefined): 'stock' | 'sell_out' | 'other' {
  const text = (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return 'other';
  if (text.includes('sell out') || text.includes('sellout')) return 'sell_out';
  if (text.includes('stock')) return 'stock';
  return 'other';
}

function toScopeLabel(scope: StockScope) {
  if (scope === 'private') return 'Private';
  if (scope === 'public') return 'Public';
  return 'Total';
}

type ExplainerRow = {
  label: string;
  current: number | null;
  momDelta: number | null;
  ytdAvgDelta: number | null;
};

type ChannelSummaryRow = {
  scope: StockScope;
  label: string;
  current: number | null;
  previous: number | null;
  ytdAvg: number | null;
  ytdPyAvg: number | null;
  target: number | null;
  variance: number | null;
  momDelta: number | null;
};

export function DsoDashboardPanel({
  overviewRows,
  trendRows,
  tableRows,
  initialGroup,
  stockRows,
  stockTargets,
}: DsoDashboardPanelProps) {
  const initial = initialGroup || tableRows[0]?.groupName || overviewRows[0]?.groupName || '';
  const [selectedGroup, setSelectedGroup] = useState(initial);
  const [activeView, setActiveView] = useState<'dso' | 'stock'>('dso');
  const [selectedStockScope, setSelectedStockScope] = useState<StockScope>('total');
  const [stockBusinessTypeFilter, setStockBusinessTypeFilter] = useState('');
  const [stockClientInstitutionFilter, setStockClientInstitutionFilter] = useState('');
  const [stockSkuFilter, setStockSkuFilter] = useState('');

  const selectedOverview = findGroup(overviewRows, selectedGroup);
  const selectedTable = findGroup(tableRows, selectedGroup);
  const selectedTarget = selectedTable?.target ?? null;
  const selectedVariance = selectedTable?.variance ?? null;
  const reportPeriodDate = toMonthDate(selectedOverview?.reportPeriodMonth ?? null);
  const previousMonthDate = subOneMonth(reportPeriodDate);
  const pyYearLabel = reportPeriodDate ? String(reportPeriodDate.getUTCFullYear() - 1) : 'PY';

  const selectedTrendRows = trendRows
    .filter((row) => normalizeLabel(row.groupName) === normalizeLabel(selectedGroup))
    .map((row) => ({
      periodMonth: row.periodMonth,
      dsoValue: row.dsoValue,
      targetValue: selectedTarget,
    }));

  const orderedTableRows = useMemo(() => {
    const map = new Map(tableRows.map((row) => [normalizeLabel(row.groupName), row] as const));
    const ordered = GROUP_ORDER.map((name) => map.get(normalizeLabel(name))).filter(
      (row): row is DsoTableRow => Boolean(row),
    );
    const remaining = tableRows
      .filter((row) => !GROUP_ORDER.some((name) => normalizeLabel(name) === normalizeLabel(row.groupName)))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
    return [...ordered, ...remaining];
  }, [tableRows]);

  const groupTabs = useMemo(() => orderedTableRows.map((row) => row.groupName), [orderedTableRows]);

  const stockMonthlyByScope = useMemo(() => {
    const byKey = new Map<
      string,
      {
        scope: StockScope;
        periodMonth: string;
        stock: number;
        sellOut: number;
        isYtd: boolean;
        isYtdPy: boolean;
        isMth: boolean;
        isMthPy: boolean;
      }
    >();

    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      const scopes: StockScope[] = ['total'];
      if (rowScope === 'private') scopes.push('private');
      if (rowScope === 'public') scopes.push('public');
      const stockType = normalizeStockType(row.stockType);
      if (stockType === 'other') continue;

      for (const scope of scopes) {
        const key = `${scope}|${row.periodMonth}`;
        const current = byKey.get(key) ?? {
          scope,
          periodMonth: row.periodMonth,
          stock: 0,
          sellOut: 0,
          isYtd: false,
          isYtdPy: false,
          isMth: false,
          isMthPy: false,
        };
        if (stockType === 'stock') current.stock += row.stockValue;
        if (stockType === 'sell_out') current.sellOut += row.stockValue;
        current.isYtd = current.isYtd || row.isYtd;
        current.isYtdPy = current.isYtdPy || row.isYtdPy;
        current.isMth = current.isMth || row.isMth;
        current.isMthPy = current.isMthPy || row.isMthPy;
        byKey.set(key, current);
      }
    }

    return [...byKey.values()].map((row) => ({
      ...row,
      doh: row.sellOut > 0 ? (row.stock / row.sellOut) * 30 : null,
    }));
  }, [stockRows]);

  const stockChannelRows = useMemo(() => {
    const toPeriod = (value: string) => new Date(`${value}T00:00:00`);
    const toPeriodKey = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);
    const minusOneMonthKey = (value: string | null) => {
      if (!value) return null;
      const date = toPeriod(value);
      if (Number.isNaN(date.getTime())) return null;
      date.setUTCMonth(date.getUTCMonth() - 1);
      return toPeriodKey(date);
    };

    const summarize = (scope: StockScope): ChannelSummaryRow => {
      const scoped = stockMonthlyByScope.filter((row) => row.scope === scope);
      const current = scoped.find((row) => row.isMth)?.doh ?? null;
      const currentPeriod = scoped.find((row) => row.isMth)?.periodMonth ?? scoped.map((row) => row.periodMonth).sort().at(-1) ?? null;
      const previousPeriod = minusOneMonthKey(currentPeriod);
      const previous = previousPeriod ? scoped.find((row) => row.periodMonth === previousPeriod)?.doh ?? null : null;
      const ytdValues = scoped.filter((row) => row.isYtd && row.doh != null).map((row) => row.doh as number);
      const ytdPyValues = scoped.filter((row) => row.isYtdPy && row.doh != null).map((row) => row.doh as number);
      const ytdAvg = ytdValues.length > 0 ? ytdValues.reduce((a, b) => a + b, 0) / ytdValues.length : null;
      const ytdPyAvg = ytdPyValues.length > 0 ? ytdPyValues.reduce((a, b) => a + b, 0) / ytdPyValues.length : null;
      const target =
        scope === 'private'
          ? stockTargets.privateDays
          : scope === 'public'
            ? stockTargets.publicDays
            : stockTargets.totalDays;
      return {
        scope,
        label: toScopeLabel(scope),
        current,
        previous,
        ytdAvg,
        ytdPyAvg,
        target,
        variance: current != null && target != null ? current - target : null,
        momDelta: current != null && previous != null ? current - previous : null,
      };
    };

    return [summarize('total'), summarize('private'), summarize('public')];
  }, [stockMonthlyByScope, stockTargets]);

  const selectedStockRow = useMemo(
    () => stockChannelRows.find((row) => row.scope === selectedStockScope) ?? stockChannelRows[0] ?? null,
    [stockChannelRows, selectedStockScope],
  );

  const selectedStockTrendRows = useMemo(
    () =>
      stockMonthlyByScope
        .filter((row) => row.scope === selectedStockScope)
        .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
        .map((row) => ({
          periodMonth: row.periodMonth,
          dsoValue: row.doh ?? 0,
          targetValue: selectedStockRow?.target ?? null,
          stockValue: row.stock,
          sellOutValue: row.sellOut,
        })),
    [stockMonthlyByScope, selectedStockScope, selectedStockRow],
  );

  const stockReportPeriod = (() => {
    const fromMth = stockMonthlyByScope
      .filter((row) => row.scope === selectedStockScope && row.isMth)
      .map((row) => row.periodMonth)
      .sort()
      .at(-1);
    if (fromMth) return toMonthDate(fromMth);
    const fallback = stockMonthlyByScope
      .filter((row) => row.scope === selectedStockScope)
      .map((row) => row.periodMonth)
      .sort()
      .at(-1);
    return toMonthDate(fallback ?? null);
  })();

  const stockPreviousMonth = subOneMonth(stockReportPeriod);

  const stockBusinessTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      if (selectedStockScope === 'private' && rowScope !== 'private') continue;
      if (selectedStockScope === 'public' && rowScope !== 'public') continue;
      const value = (row.businessType ?? '').trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockRows, selectedStockScope]);

  const stockClientInstitutionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      if (selectedStockScope === 'private' && rowScope !== 'private') continue;
      if (selectedStockScope === 'public' && rowScope !== 'public') continue;
      if (stockBusinessTypeFilter && (row.businessType ?? '').trim() !== stockBusinessTypeFilter) continue;
      const value = (row.clientInstitution ?? '').trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockRows, selectedStockScope, stockBusinessTypeFilter]);

  const stockSkuOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of stockRows) {
      const rowScope = normalizeScopeFromRow(row);
      if (selectedStockScope === 'private' && rowScope !== 'private') continue;
      if (selectedStockScope === 'public' && rowScope !== 'public') continue;
      if (stockBusinessTypeFilter && (row.businessType ?? '').trim() !== stockBusinessTypeFilter) continue;
      if (stockClientInstitutionFilter && (row.clientInstitution ?? '').trim() !== stockClientInstitutionFilter) continue;
      const value = (row.canonicalProductName ?? '').trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockRows, selectedStockScope, stockBusinessTypeFilter, stockClientInstitutionFilter]);

  const stockExplainers = useMemo(() => {
    const build = (dimension: 'business_unit' | 'market_group_brand' | 'sku' | 'client_institution'): ExplainerRow[] => {
      const byKeyPeriod = new Map<
        string,
        {
          label: string;
          periodMonth: string;
          stock: number;
          sellOut: number;
          isMth: boolean;
          isMthPy: boolean;
          isYtd: boolean;
          isYtdPy: boolean;
        }
      >();

      for (const row of stockRows) {
        const rowScope = normalizeScopeFromRow(row);
        if (selectedStockScope === 'private' && rowScope !== 'private') continue;
        if (selectedStockScope === 'public' && rowScope !== 'public') continue;
        if (stockBusinessTypeFilter && (row.businessType ?? '').trim() !== stockBusinessTypeFilter) continue;
        if (stockClientInstitutionFilter && (row.clientInstitution ?? '').trim() !== stockClientInstitutionFilter) continue;
        if (stockSkuFilter && (row.canonicalProductName ?? '').trim() !== stockSkuFilter) continue;
        const stockType = normalizeStockType(row.stockType);
        if (stockType === 'other') continue;

        const labelRaw =
          dimension === 'business_unit'
            ? row.businessUnitName
            : dimension === 'market_group_brand'
              ? `${(row.marketGroup ?? '').trim() || 'Unassigned'} - ${(row.brandName ?? '').trim() || 'Unassigned'}`
              : dimension === 'sku'
                ? row.canonicalProductName
                : row.clientInstitution;
        const label = (labelRaw ?? '').trim() || 'Unassigned';
        const key = `${label}|${row.periodMonth}`;
        const current = byKeyPeriod.get(key) ?? {
          label,
          periodMonth: row.periodMonth,
          stock: 0,
          sellOut: 0,
          isMth: false,
          isMthPy: false,
          isYtd: false,
          isYtdPy: false,
        };
        if (stockType === 'stock') current.stock += row.stockValue;
        if (stockType === 'sell_out') current.sellOut += row.stockValue;
        current.isMth = current.isMth || row.isMth;
        current.isMthPy = current.isMthPy || row.isMthPy;
        current.isYtd = current.isYtd || row.isYtd;
        current.isYtdPy = current.isYtdPy || row.isYtdPy;
        byKeyPeriod.set(key, current);
      }

      const rows = [...byKeyPeriod.values()].map((row) => ({
        ...row,
        doh: row.sellOut > 0 ? (row.stock / row.sellOut) * 30 : null,
      }));

      const byLabel = new Map<
        string,
        {
          current: number | null;
          previous: number | null;
          ytd: number[];
          ytdPy: number[];
        }
      >();

      for (const row of rows) {
        const current = byLabel.get(row.label) ?? { current: null, previous: null, ytd: [], ytdPy: [] };
        if (row.isMth) current.current = row.doh;
        if (row.isMthPy) current.previous = row.doh;
        if (row.isYtd && row.doh != null) current.ytd.push(row.doh);
        if (row.isYtdPy && row.doh != null) current.ytdPy.push(row.doh);
        byLabel.set(row.label, current);
      }

      return [...byLabel.entries()]
        .map(([label, value]) => {
          const ytdAvg = value.ytd.length ? value.ytd.reduce((a, b) => a + b, 0) / value.ytd.length : null;
          const ytdPyAvg = value.ytdPy.length ? value.ytdPy.reduce((a, b) => a + b, 0) / value.ytdPy.length : null;
          return {
            label,
            current: value.current,
            momDelta: value.current != null && value.previous != null ? value.current - value.previous : null,
            ytdAvgDelta: ytdAvg != null && ytdPyAvg != null ? ytdAvg - ytdPyAvg : null,
          };
        })
        .sort((a, b) => (b.current ?? -Infinity) - (a.current ?? -Infinity))
        .slice(0, 8);
    };

    return {
      businessUnit: build('business_unit'),
      marketGroupBrand: build('market_group_brand'),
      sku: build('sku'),
      clientInstitution: build('client_institution'),
    };
  }, [stockRows, selectedStockScope, stockBusinessTypeFilter, stockClientInstitutionFilter, stockSkuFilter]);

  const renderExplainerTable = (title: string, rows: ExplainerRow[]) => (
    <article className="rounded-[14px] border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</p>
      <div className="mt-2 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left">Segment</th>
              <th className="px-2 py-2 text-right">DOH</th>
              <th className="px-2 py-2 text-center">Status</th>
              <th className="px-2 py-2 text-right">vsMoM</th>
              <th className="px-2 py-2 text-right">vsAvg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${title}-${row.label}`}>
                <td className="px-2 py-2 text-left font-medium text-slate-800">{row.label}</td>
                <td
                  className={`px-2 py-2 text-right font-semibold ${
                    row.current == null || selectedStockRow?.target == null
                      ? 'text-slate-900'
                      : row.current <= selectedStockRow.target
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}
                >
                  {formatDsoValue(row.current)}
                </td>
                <td className="px-2 py-2 text-center">
                  {row.current != null && selectedStockRow?.target != null ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        row.current <= selectedStockRow.target
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {row.current <= selectedStockRow.target ? 'On target' : 'Above target'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">N/A</span>
                  )}
                </td>
                <td
                  className={`px-2 py-2 text-right font-semibold ${
                    row.momDelta == null ? 'text-slate-500' : row.momDelta <= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {row.momDelta == null ? 'N/A' : `${row.momDelta > 0 ? '+' : ''}${row.momDelta.toFixed(1)}`}
                </td>
                <td
                  className={`px-2 py-2 text-right font-semibold ${
                    row.ytdAvgDelta == null
                      ? 'text-slate-500'
                      : row.ytdAvgDelta <= 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}
                >
                  {row.ytdAvgDelta == null ? 'N/A' : `${row.ytdAvgDelta > 0 ? '+' : ''}${row.ytdAvgDelta.toFixed(1)}`}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-2 py-2 text-center text-slate-500" colSpan={5}>
                  No data
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveView('dso')}
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
            activeView === 'dso' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          DSO View
        </button>
        <button
          type="button"
          onClick={() => setActiveView('stock')}
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
            activeView === 'stock' ? 'bg-slate-900 text-white' : 'text-slate-600'
          }`}
        >
          Stock View
        </button>
      </div>

      {activeView === 'stock' ? (
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)] space-y-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">STOCK VIEW (DOH)</p>

          <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Channel</th>
                  <th className="px-3 py-2 text-right">DOH Current</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockChannelRows.map((row) => {
                  const active = row.scope === selectedStockScope;
                  return (
                    <tr
                      key={row.scope}
                      className={`cursor-pointer transition ${active ? 'bg-sky-50/60' : 'hover:bg-slate-50'}`}
                      onClick={() => setSelectedStockScope(row.scope)}
                    >
                      <td className="px-3 py-2 text-left font-medium text-slate-800">{row.label}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.current)}</td>
                      <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.target)}</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          row.variance == null ? 'text-slate-500' : row.variance <= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {row.variance == null ? 'N/A' : `${row.variance > 0 ? '+' : ''}${row.variance.toFixed(1)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-1 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
            {(['total', 'private', 'public'] as const).map((scope) => {
              const active = scope === selectedStockScope;
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setSelectedStockScope(scope)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {toScopeLabel(scope)}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">DOH Trend vs Target</h2>
              <p className="mt-1 text-sm text-slate-600">
                {selectedStockRow?.label ?? 'N/A'} | Current: {formatDsoValue(selectedStockRow?.current ?? null)} | Target:{' '}
                {formatDsoValue(selectedStockRow?.target ?? null)} | Var:{' '}
                {selectedStockRow?.variance == null
                  ? 'N/A'
                  : `${selectedStockRow.variance > 0 ? '+' : ''}${selectedStockRow.variance.toFixed(1)}`}
              </p>
              <div className="mt-3">
                <DsoTrendChart rows={selectedStockTrendRows} metricLabel="DOH" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">MoM (Current vs Prev Month)</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedStockRow?.momDelta == null
                        ? 'text-slate-700'
                        : selectedStockRow.momDelta <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedStockRow?.momDelta == null
                      ? 'N/A'
                      : `${selectedStockRow.momDelta > 0 ? '+' : ''}${selectedStockRow.momDelta.toFixed(1)} days`}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">YTD Avg vs LY Avg</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedStockRow?.ytdAvg == null || selectedStockRow?.ytdPyAvg == null
                        ? 'text-slate-700'
                        : selectedStockRow.ytdAvg - selectedStockRow.ytdPyAvg <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedStockRow?.ytdAvg == null || selectedStockRow?.ytdPyAvg == null
                      ? 'N/A'
                      : `${selectedStockRow.ytdAvg - selectedStockRow.ytdPyAvg > 0 ? '+' : ''}${(
                          selectedStockRow.ytdAvg - selectedStockRow.ytdPyAvg
                        ).toFixed(1)} days`}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-slate-900">DOH Comparison Snapshot</h3>
                <p className="mt-1 text-sm text-slate-600">Avg PY | Target | M-1 | M</p>
                <div className="mt-3">
                  <DsoComparisonBarChart
                    pyAvg={selectedStockRow?.ytdPyAvg ?? null}
                    target={selectedStockRow?.target ?? null}
                    mMinus1={selectedStockRow?.previous ?? null}
                    current={selectedStockRow?.current ?? null}
                    metricLabel="DOH"
                    pyAvgLabel={`Average ${(stockReportPeriod ? stockReportPeriod.getUTCFullYear() - 1 : 'PY')}`}
                    targetLabel="Current Target"
                    mMinus1Label={`Previous Month (${toYyyyMmDd(stockPreviousMonth)})`}
                    currentLabel={`Current Month (${toYyyyMmDd(stockReportPeriod)})`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <select
              value={stockBusinessTypeFilter}
              onChange={(e) => {
                setStockBusinessTypeFilter(e.target.value);
                setStockClientInstitutionFilter('');
                setStockSkuFilter('');
              }}
              className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All Business Types</option>
              {stockBusinessTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={stockClientInstitutionFilter}
              onChange={(e) => setStockClientInstitutionFilter(e.target.value)}
              className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All Clients/Institutions</option>
              {stockClientInstitutionOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={stockSkuFilter}
              onChange={(e) => setStockSkuFilter(e.target.value)}
              className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All SKU</option>
              {stockSkuOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              DOH corresponds current month {toYyyyMmDd(stockReportPeriod)}.
            </p>
            <p>
              vsMoM difference vs DOH previous month.
            </p>
            <p>
              vsAvg difference vs YTD Average.
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · Business Unit`, stockExplainers.businessUnit)}
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · MarketGroup - Brand`, stockExplainers.marketGroupBrand)}
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · SKU`, stockExplainers.sku)}
            {renderExplainerTable(`${toScopeLabel(selectedStockScope)} Behavior · Client / Institution`, stockExplainers.clientInstitution)}
          </div>
        </article>
      ) : null}

      {activeView === 'dso' ? (
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">DSO BY GROUP Current vs Target</p>
          </div>

          <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">DSO by Group (MTH)</p>
            <div className="mt-3 overflow-hidden rounded-[12px] border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">DSO Name</th>
                    <th className="px-3 py-2 text-right">Current</th>
                    <th className="px-3 py-2 text-right">Target</th>
                    <th className="px-3 py-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderedTableRows.map((row) => {
                    const active = normalizeLabel(row.groupName) === normalizeLabel(selectedGroup);
                    return (
                      <tr
                        key={row.groupName}
                        className={`cursor-pointer transition ${active ? 'bg-sky-50/60' : 'hover:bg-slate-50'}`}
                        onClick={() => setSelectedGroup(row.groupName)}
                      >
                        <td className="px-3 py-2 text-left font-medium text-slate-800">{row.groupName}</td>
                        <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.currentValue)}</td>
                        <td className="px-3 py-2 text-right text-slate-900">{formatDsoValue(row.target)}</td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            row.variance == null ? 'text-slate-500' : row.variance <= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {row.variance == null ? 'N/A' : `${row.variance > 0 ? '+' : ''}${row.variance.toFixed(1)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1 rounded-full border border-slate-300 bg-white p-1 w-fit">
            {groupTabs.map((groupName) => {
              const active = normalizeLabel(groupName) === normalizeLabel(selectedGroup);
              return (
                <button
                  key={groupName}
                  type="button"
                  onClick={() => setSelectedGroup(groupName)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {groupName}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">DSO Trend vs Target</h2>
              <p className="mt-1 text-xs text-slate-500">
                DSO shows the increase or decrease in days elapsed from invoice issue date to payment receipt date.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {selectedGroup} | Current:{' '}
                {formatDsoValue(findGroup(tableRows, selectedGroup)?.currentValue ?? selectedOverview?.dsoReportPeriod ?? null)} |
                Target: {formatDsoValue(selectedTarget)} | Var:{' '}
                {selectedVariance == null ? 'N/A' : `${selectedVariance > 0 ? '+' : ''}${selectedVariance.toFixed(1)}`}
              </p>
              <div className="mt-3">
                <DsoTrendChart rows={selectedTrendRows} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">MoM (Current vs Prev Month)</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedTable?.momDelta == null
                        ? 'text-slate-700'
                        : selectedTable.momDelta <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedTable?.momDelta == null
                      ? 'N/A'
                      : `${selectedTable.momDelta > 0 ? '+' : ''}${selectedTable.momDelta.toFixed(1)} days`}
                  </p>
                </div>
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <p className="uppercase tracking-[0.12em] text-slate-500">YTD Avg vs LY Avg</p>
                  <p
                    className={`mt-1 font-semibold ${
                      selectedTable?.ytdAvgDelta == null
                        ? 'text-slate-700'
                        : selectedTable.ytdAvgDelta <= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                    }`}
                  >
                    {selectedTable?.ytdAvgDelta == null
                      ? 'N/A'
                      : `${selectedTable.ytdAvgDelta > 0 ? '+' : ''}${selectedTable.ytdAvgDelta.toFixed(1)} days`}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-slate-900">DSO Comparison Snapshot</h3>
                <p className="mt-1 text-sm text-slate-600">Avg PY | Target | M-1 | M</p>
                <div className="mt-3">
                  <DsoComparisonBarChart
                    pyAvg={selectedTable?.ytdAvgPy ?? null}
                    target={selectedTarget}
                    mMinus1={selectedTable?.previousMonthValue ?? null}
                    current={selectedTable?.currentValue ?? null}
                    pyAvgLabel={`Average ${pyYearLabel}`}
                    targetLabel="Current Target"
                    mMinus1Label={`Previous Month (${toYyyyMmDd(previousMonthDate)})`}
                    currentLabel={`Current Month (${toYyyyMmDd(reportPeriodDate)})`}
                  />
                </div>
              </div>
            </div>
          </div>
        </article>
      ) : null}
    </div>
  );
}
