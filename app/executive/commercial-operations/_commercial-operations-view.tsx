import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { SectionHeader } from '@/components/ui/section-header';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import {
  getCommercialOperationsAuditSources,
  getCommercialOperationsDeliveryOrderRows,
  getCommercialOperationsDsoOverview,
  getCommercialOperationsDsoTrend,
  getCommercialOperationsGovernmentContractProgressRows,
  getCommercialOperationsStocksRows,
} from '@/lib/data/commercial-operations';
import { getAdminTargets } from '@/lib/data/targets';
import { DsoDashboardPanel } from '@/components/executive/commercial-operations/dso-dashboard-panel';
import { ScorecardInsightSections } from '@/components/executive/shared/scorecard-insight-sections';

export type CommercialOperationsViewMode = 'insights' | 'scorecard' | 'dashboard';

type SearchParams = {
  version?: string;
};

function modeHref(mode: CommercialOperationsViewMode, params: SearchParams) {
  const query = new URLSearchParams();
  if (params.version) query.set('version', params.version);
  const queryText = query.toString();
  return `/executive/commercial-operations/${mode}${queryText ? `?${queryText}` : ''}`;
}

function formatMonth(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toStatusLabel(value: string | null) {
  if (!value) return 'not_loaded';
  return value.toUpperCase();
}

function formatSigned(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function tagMetricLine(text: string) {
  const isDoh = text.startsWith('[DOH] ');
  const isGcp = text.startsWith('[GCP] ');
  const isDso = !isDoh && !isGcp;
  const cleanText = isDoh ? text.replace('[DOH] ', '') : text;
  const cleanText2 = isGcp ? cleanText.replace('[GCP] ', '') : cleanText;
  return `${isDoh ? 'DOH' : isGcp ? 'GCP' : isDso ? 'DSO' : 'DSO'}|||${cleanText2}`;
}

function getDsoTargetByGroup(
  groupName: string,
  targetRows: Awaited<ReturnType<typeof getAdminTargets>>,
): number | null {
  const normalizeLabel = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
  const groupNorm = normalizeLabel(groupName);
  const stripDsoPrefix = (value: string) => value.replace(/^dso[\s\-:]+/i, '');
  const row = targetRows.find((item) => {
    if (!item.isActive) return false;
    const kpiNorm = normalizeLabel(item.kpiName);
    return kpiNorm === groupNorm || normalizeLabel(stripDsoPrefix(item.kpiName)) === groupNorm;
  });
  return row?.targetValueNumeric ?? null;
}

function getCommercialOperationsStockTargets(
  targetRows: Awaited<ReturnType<typeof getAdminTargets>>,
) {
  const normalizeLabel = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
  const rows = targetRows.filter((item) => item.isActive);
  const findTarget = (pattern: RegExp) =>
    rows.find((item) => pattern.test(normalizeLabel(item.kpiName ?? ''))) ?? null;

  const total = findTarget(/^doh\s+total\s+chiesi$/i)?.targetValueNumeric ?? null;
  const privateTarget = findTarget(/^doh\s+privado$/i)?.targetValueNumeric ?? null;

  const publicRow =
    findTarget(/^doh\s+gobierno/i) ??
    findTarget(/^moh\s+gobierno/i);
  const publicNumeric = publicRow?.targetValueNumeric ?? null;
  const publicIsMonths =
    (publicRow?.qtyUnit ?? '').toLowerCase().includes('month') ||
    /^moh/i.test(publicRow?.kpiName ?? '');
  const publicDays = publicNumeric == null ? null : publicIsMonths ? publicNumeric * 30 : publicNumeric;

  return {
    totalDays: total,
    privateDays: privateTarget,
    publicDays,
  };
}

function getCommercialOperationsDeliveryTargets(
  targetRows: Awaited<ReturnType<typeof getAdminTargets>>,
) {
  const normalizeLabel = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
  const rows = targetRows.filter((item) => item.isActive);
  const findTarget = (pattern: RegExp) =>
    rows.find((item) => pattern.test(normalizeLabel(item.kpiName ?? ''))) ?? null;

  const fillRateGovernment = findTarget(/^fill\s*rate\s+gobierno$/i)?.targetValueNumeric ?? null;
  const fillRatePrivate = findTarget(/^fill\s*rate\s+privado$/i)?.targetValueNumeric ?? null;
  const leadTimeGovernment = findTarget(/^lead\s*time\s+gobierno$/i)?.targetValueNumeric ?? null;
  const leadTimePrivate = findTarget(/^lead\s*time\s+privado$/i)?.targetValueNumeric ?? null;

  return {
    fillRateGovernment,
    fillRatePrivate,
    leadTimeGovernment,
    leadTimePrivate,
  };
}

type ChannelBrandSignal = {
  channel: 'Private' | 'Public';
  segment: string;
  currentDoh: number | null;
  targetDoh: number | null;
  momDelta: number | null;
  ytdAvg: number | null;
  ytdAvgDelta: number | null;
  status: 'healthy' | 'risk' | 'neutral';
};

function normalizeStockType(value: string | null | undefined): 'stock' | 'sell_out' | 'other' {
  const text = (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return 'other';
  if (text.includes('sell out') || text.includes('sellout')) return 'sell_out';
  if (text.includes('stock')) return 'stock';
  return 'other';
}

function normalizeScopeFromStockRow(
  row: Awaited<ReturnType<typeof getCommercialOperationsStocksRows>>[number],
): 'private' | 'public' | 'unknown' {
  const text = `${row.businessType ?? ''} ${row.market ?? ''}`.toLowerCase();
  if (text.includes('gobierno') || text.includes('government') || text.includes('public')) return 'public';
  if (text.includes('privado') || text.includes('private')) return 'private';
  return 'unknown';
}

function subMonthKey(periodMonth: string | null) {
  if (!periodMonth) return null;
  const date = new Date(`${periodMonth}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
}

function buildChannelBrandSignals(
  stockRows: Awaited<ReturnType<typeof getCommercialOperationsStocksRows>>,
  stockTargets: ReturnType<typeof getCommercialOperationsStockTargets>,
): ChannelBrandSignal[] {
  const byKey = new Map<
    string,
    {
      channel: 'Private' | 'Public';
      segment: string;
      periodMonth: string;
      stock: number;
      sellOut: number;
      isMth: boolean;
      isYtd: boolean;
      isYtdPy: boolean;
    }
  >();

  for (const row of stockRows) {
    const scope = normalizeScopeFromStockRow(row);
    if (scope === 'unknown') continue;
    const stockType = normalizeStockType(row.stockType);
    if (stockType === 'other') continue;
    const marketGroup = (row.marketGroup ?? '').trim();
    const brandName = (row.brandName ?? '').trim();
    const segment = `${marketGroup || 'Unassigned'} - ${brandName || 'Unassigned'}`;
    const channel: 'Private' | 'Public' = scope === 'private' ? 'Private' : 'Public';
    const key = `${channel}|${segment}|${row.periodMonth}`;
    const current = byKey.get(key) ?? {
      channel,
      segment,
      periodMonth: row.periodMonth,
      stock: 0,
      sellOut: 0,
      isMth: false,
      isYtd: false,
      isYtdPy: false,
    };
    if (stockType === 'stock') current.stock += row.stockValue;
    if (stockType === 'sell_out') current.sellOut += row.stockValue;
    current.isMth = current.isMth || row.isMth;
    current.isYtd = current.isYtd || row.isYtd;
    current.isYtdPy = current.isYtdPy || row.isYtdPy;
    byKey.set(key, current);
  }

  const byChannelSegment = new Map<
    string,
    {
      channel: 'Private' | 'Public';
      segment: string;
      currentPeriod: string | null;
      currentDoh: number | null;
      previousDoh: number | null;
      ytd: number[];
      ytdPy: number[];
    }
  >();

  const rows = [...byKey.values()].map((row) => ({
    ...row,
    doh: row.sellOut > 0 ? (row.stock / row.sellOut) * 30 : null,
  }));

  for (const row of rows) {
    const key = `${row.channel}|${row.segment}`;
    const current = byChannelSegment.get(key) ?? {
      channel: row.channel,
      segment: row.segment,
      currentPeriod: null,
      currentDoh: null,
      previousDoh: null,
      ytd: [],
      ytdPy: [],
    };
    if (row.isMth) {
      current.currentPeriod = row.periodMonth;
      current.currentDoh = row.doh;
    }
    if (row.isYtd && row.doh != null) current.ytd.push(row.doh);
    if (row.isYtdPy && row.doh != null) current.ytdPy.push(row.doh);
    byChannelSegment.set(key, current);
  }

  for (const item of byChannelSegment.values()) {
    const prevPeriod = subMonthKey(item.currentPeriod);
    if (!prevPeriod) continue;
    const row = rows.find(
      (r) => r.channel === item.channel && r.segment === item.segment && r.periodMonth === prevPeriod,
    );
    item.previousDoh = row?.doh ?? null;
  }

  return [...byChannelSegment.values()]
    .map((row) => {
      const targetDoh = row.channel === 'Private' ? stockTargets.privateDays : stockTargets.publicDays;
      const ytdAvg = row.ytd.length ? row.ytd.reduce((a, b) => a + b, 0) / row.ytd.length : null;
      const ytdPyAvg = row.ytdPy.length ? row.ytdPy.reduce((a, b) => a + b, 0) / row.ytdPy.length : null;
      const momDelta =
        row.currentDoh != null && row.previousDoh != null ? row.currentDoh - row.previousDoh : null;
      const ytdAvgDelta = ytdAvg != null && ytdPyAvg != null ? ytdAvg - ytdPyAvg : null;

      let status: 'healthy' | 'risk' | 'neutral' = 'neutral';
      if (row.currentDoh != null && targetDoh != null && momDelta != null) {
        if (row.currentDoh <= targetDoh && momDelta <= 0) status = 'healthy';
        if (row.currentDoh > targetDoh && momDelta > 0) status = 'risk';
      }

      return {
        channel: row.channel,
        segment: row.segment,
        currentDoh: row.currentDoh,
        targetDoh,
        momDelta,
        ytdAvg,
        ytdAvgDelta,
        status,
      };
    })
    .filter((row) => row.currentDoh != null)
    .sort((a, b) => (b.currentDoh ?? 0) - (a.currentDoh ?? 0));
}

type DsoScorecardRow = {
  groupName: string;
  currentValue: number | null;
  previousMonthValue: number | null;
  varianceMoM: number | null;
  ytdAvg: number | null;
  ytdAvgPy: number | null;
  varianceYtdAvgVsPy: number | null;
  target: number | null;
  variance: number | null;
  pyValue: number | null;
  varianceVsPy: number | null;
};

function formatOneDecimal(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(1);
}

function formatInteger(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function ChannelBadge({ channel }: { channel: 'Private' | 'Public' }) {
  const classes =
    channel === 'Private'
      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
      : 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${classes}`}
    >
      {channel === 'Private' ? 'PVT' : 'PUB'}
    </span>
  );
}

type StockTotalSummary = {
  currentDoh: number | null;
  targetDoh: number | null;
  variance: number | null;
};

type StockChannelSummary = {
  scope: 'total' | 'private' | 'public';
  label: 'Total' | 'Private' | 'Public';
  currentDoh: number | null;
  targetDoh: number | null;
  variance: number | null;
  momDelta: number | null;
};

type GovernmentContractsSummary = {
  progress2026Pct: number | null;
  target2026Pct: number | null;
  variancePp: number | null;
};

type DeliveryGlobalSummary = {
  scopeLabel: string;
  fillRatePct: number | null;
  fillRateTargetPct: number | null;
  fillRateVariancePp: number | null;
  leadTimeDays: number | null;
  leadTimeTargetDays: number | null;
  leadTimeVarianceDays: number | null;
};

function buildStockTotalSummary(
  stockRows: Awaited<ReturnType<typeof getCommercialOperationsStocksRows>>,
  stockTargets: ReturnType<typeof getCommercialOperationsStockTargets>,
): StockTotalSummary {
  const byPeriod = new Map<
    string,
    { periodMonth: string; stock: number; sellOut: number; isMth: boolean }
  >();

  for (const row of stockRows) {
    const stockType = normalizeStockType(row.stockType);
    if (stockType === 'other') continue;
    const current = byPeriod.get(row.periodMonth) ?? {
      periodMonth: row.periodMonth,
      stock: 0,
      sellOut: 0,
      isMth: false,
    };
    if (stockType === 'stock') current.stock += row.stockValue;
    if (stockType === 'sell_out') current.sellOut += row.stockValue;
    current.isMth = current.isMth || row.isMth;
    byPeriod.set(row.periodMonth, current);
  }

  const monthly = [...byPeriod.values()].map((row) => ({
    ...row,
    doh: row.sellOut > 0 ? (row.stock / row.sellOut) * 30 : null,
  }));
  const currentDoh =
    monthly.find((row) => row.isMth)?.doh ??
    monthly.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth)).at(-1)?.doh ??
    null;
  const targetDoh = stockTargets.totalDays;
  return {
    currentDoh,
    targetDoh,
    variance: currentDoh != null && targetDoh != null ? currentDoh - targetDoh : null,
  };
}

function buildStockChannelSummaries(
  stockRows: Awaited<ReturnType<typeof getCommercialOperationsStocksRows>>,
  stockTargets: ReturnType<typeof getCommercialOperationsStockTargets>,
): StockChannelSummary[] {
  const aggregateScope = (scope: 'total' | 'private' | 'public') => {
    const byPeriod = new Map<string, { periodMonth: string; stock: number; sellOut: number; isMth: boolean }>();
    for (const row of stockRows) {
      const rowScope = normalizeScopeFromStockRow(row);
      if (scope === 'private' && rowScope !== 'private') continue;
      if (scope === 'public' && rowScope !== 'public') continue;
      const stockType = normalizeStockType(row.stockType);
      if (stockType === 'other') continue;
      const current = byPeriod.get(row.periodMonth) ?? {
        periodMonth: row.periodMonth,
        stock: 0,
        sellOut: 0,
        isMth: false,
      };
      if (stockType === 'stock') current.stock += row.stockValue;
      if (stockType === 'sell_out') current.sellOut += row.stockValue;
      current.isMth = current.isMth || row.isMth;
      byPeriod.set(row.periodMonth, current);
    }
    const monthly = [...byPeriod.values()].map((row) => ({
      ...row,
      doh: row.sellOut > 0 ? (row.stock / row.sellOut) * 30 : null,
    }));
    const currentPeriod =
      monthly.find((row) => row.isMth)?.periodMonth ??
      monthly.map((row) => row.periodMonth).sort().at(-1) ??
      null;
    const currentDoh =
      (currentPeriod ? monthly.find((row) => row.periodMonth === currentPeriod)?.doh : null) ?? null;
    const prevPeriod = subMonthKey(currentPeriod);
    const previousDoh =
      (prevPeriod ? monthly.find((row) => row.periodMonth === prevPeriod)?.doh : null) ?? null;
    const targetDoh =
      scope === 'private'
        ? stockTargets.privateDays
        : scope === 'public'
          ? stockTargets.publicDays
          : stockTargets.totalDays;
    return {
      scope,
      label: scope === 'private' ? 'Private' : scope === 'public' ? 'Public' : 'Total',
      currentDoh,
      targetDoh,
      variance: currentDoh != null && targetDoh != null ? currentDoh - targetDoh : null,
      momDelta: currentDoh != null && previousDoh != null ? currentDoh - previousDoh : null,
    } as StockChannelSummary;
  };

  return [aggregateScope('total'), aggregateScope('private'), aggregateScope('public')];
}

function normalizeGovernmentStage(value: string | null | undefined): 'ordenado' | 'entregado' | 'facturado' | 'other' {
  const text = (value ?? '').toLowerCase().trim();
  if (!text) return 'other';
  if (text.includes('orden')) return 'ordenado';
  if (text.includes('entreg')) return 'entregado';
  if (text.includes('factur')) return 'facturado';
  return 'other';
}

function buildGovernmentContractsSummary(
  rows: Awaited<ReturnType<typeof getCommercialOperationsGovernmentContractProgressRows>>,
): GovernmentContractsSummary {
  let scopedRows = rows.filter((row) => normalizeGovernmentStage(row.category) === 'ordenado');
  if (scopedRows.length === 0) scopedRows = rows.filter((row) => normalizeGovernmentStage(row.category) === 'entregado');
  if (scopedRows.length === 0) scopedRows = rows.filter((row) => normalizeGovernmentStage(row.category) === 'facturado');
  if (scopedRows.length === 0) {
    return { progress2026Pct: null, target2026Pct: null, variancePp: null };
  }

  const currentYear = (() => {
    const anchor =
      scopedRows.map((row) => row.reportPeriodMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ??
      scopedRows.map((row) => row.latestPeriodMonth).filter((value): value is string => Boolean(value)).sort().at(-1) ??
      null;
    if (!anchor) return null;
    const parsed = new Date(`${anchor}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return String(parsed.getUTCFullYear());
  })();
  const yearPrefix = currentYear ? `${currentYear}-` : null;

  const delivered2026 = scopedRows
    .filter((row) => row.isYtd && (!yearPrefix || row.periodMonth.startsWith(yearPrefix)))
    .reduce((sum, row) => sum + row.deliveredQuantity, 0);

  const denominatorSnapshotMonth =
    scopedRows
      .map((row) => row.periodMonth)
      .filter((value) => Boolean(value))
      .sort()
      .at(0) ?? null;
  const max2026 = denominatorSnapshotMonth
    ? scopedRows
        .filter((row) => row.periodMonth === denominatorSnapshotMonth)
        .reduce((sum, row) => sum + (row.maxQuantity2026Safe ?? row.maxQuantity2026 ?? 0), 0)
    : 0;
  const progress2026Pct = max2026 > 0 ? (delivered2026 / max2026) * 100 : null;

  const ytdMonths = new Set(
    scopedRows
      .filter((row) => row.isYtd && (!yearPrefix || row.periodMonth.startsWith(yearPrefix)))
      .map((row) => row.periodMonth),
  ).size;
  const target2026Pct = ytdMonths > 0 ? (ytdMonths / 12) * 100 : null;

  return {
    progress2026Pct,
    target2026Pct,
    variancePp:
      progress2026Pct != null && target2026Pct != null ? progress2026Pct - target2026Pct : null,
  };
}

function buildDeliveryGlobalSummary(
  rows: Awaited<ReturnType<typeof getCommercialOperationsDeliveryOrderRows>>,
  targets: ReturnType<typeof getCommercialOperationsDeliveryTargets>,
): DeliveryGlobalSummary {
  const availableScopes = new Set(
    rows.map((row) => (row.orderScope ?? '').toLowerCase().trim()).filter((scope) => scope === 'government' || scope === 'private'),
  );
  const hasGovernment = availableScopes.has('government');
  const hasPrivate = availableScopes.has('private');
  const scope: 'government' | 'private' | 'total' =
    hasGovernment && hasPrivate ? 'total' : hasPrivate ? 'private' : 'government';

  const scopedRows = rows.filter((row) => {
    const rowScope = (row.orderScope ?? '').toLowerCase().trim();
    if (scope === 'total') return rowScope === 'government' || rowScope === 'private';
    return rowScope === scope;
  });
  const sourceAsOf = scopedRows
    .map((row) => row.sourceAsOfMonth)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const boundedRows = sourceAsOf
    ? scopedRows.filter((row) => row.periodMonth <= sourceAsOf)
    : scopedRows;
  const ytdRows = boundedRows.filter((row) => row.isYtd);
  const requested = ytdRows.reduce((sum, row) => sum + row.cantidadTotalPedido, 0);
  const delivered = ytdRows.reduce((sum, row) => sum + row.cantidadEntregada, 0);
  const leadRows = ytdRows
    .map((row) => row.leadTimeDays)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const fillRatePct = requested > 0 ? (delivered / requested) * 100 : null;
  const leadTimeDays =
    leadRows.length > 0 ? leadRows.reduce((a, b) => a + b, 0) / leadRows.length : null;

  const fillRateTargetPct =
    scope === 'government'
      ? targets.fillRateGovernment
      : scope === 'private'
        ? targets.fillRatePrivate
        : null;
  const leadTimeTargetDays =
    scope === 'government'
      ? targets.leadTimeGovernment
      : scope === 'private'
        ? targets.leadTimePrivate
        : null;

  return {
    scopeLabel: scope === 'government' ? 'Government' : scope === 'private' ? 'Private' : 'Total',
    fillRatePct,
    fillRateTargetPct,
    fillRateVariancePp:
      fillRatePct != null && fillRateTargetPct != null ? fillRatePct - fillRateTargetPct : null,
    leadTimeDays,
    leadTimeTargetDays,
    leadTimeVarianceDays:
      leadTimeDays != null && leadTimeTargetDays != null ? leadTimeDays - leadTimeTargetDays : null,
  };
}

function DsoGlobalCards({
  rows,
  stockTotalSummary,
  governmentContractsSummary,
  deliveryGlobalSummary,
}: {
  rows: DsoScorecardRow[];
  stockTotalSummary: StockTotalSummary;
  governmentContractsSummary: GovernmentContractsSummary;
  deliveryGlobalSummary: DeliveryGlobalSummary;
}) {
  const normalizeLabel = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
  const annualGeneral = rows.find((row) => normalizeLabel(row.groupName) === normalizeLabel('Anual / General')) ?? null;
  const totalCurrent = stockTotalSummary.currentDoh;
  const totalTarget = stockTotalSummary.targetDoh;
  const totalVariance = stockTotalSummary.variance;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Global Chiesi DSO</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatOneDecimal(annualGeneral?.currentValue)}</p>
        <p className="mt-2 text-sm text-slate-600">
          Target: {formatOneDecimal(annualGeneral?.target)} | Var:{' '}
          {annualGeneral?.variance == null ? 'N/A' : `${annualGeneral.variance > 0 ? '+' : ''}${annualGeneral.variance.toFixed(1)}`}
        </p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total DOH</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatOneDecimal(totalCurrent)}</p>
        <p className={`mt-2 text-sm ${totalVariance == null ? 'text-slate-600' : totalVariance <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
          Target: {formatOneDecimal(totalTarget)} | Variance: {totalVariance == null ? 'N/A' : `${totalVariance > 0 ? '+' : ''}${totalVariance.toFixed(1)}`}
        </p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Government Contracts</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {governmentContractsSummary.progress2026Pct == null
            ? 'N/A'
            : `${governmentContractsSummary.progress2026Pct.toFixed(1)}%`}
        </p>
        <p
          className={`mt-2 text-sm ${
            governmentContractsSummary.variancePp == null
              ? 'text-slate-600'
              : governmentContractsSummary.variancePp >= 0
                ? 'text-emerald-700'
                : 'text-rose-700'
          }`}
        >
          Target:{' '}
          {governmentContractsSummary.target2026Pct == null
            ? 'N/A'
            : `${governmentContractsSummary.target2026Pct.toFixed(1)}%`}{' '}
          | Variance:{' '}
          {governmentContractsSummary.variancePp == null
            ? 'N/A'
            : `${governmentContractsSummary.variancePp > 0 ? '+' : ''}${governmentContractsSummary.variancePp.toFixed(1)}pp`}
        </p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fill Rate &amp; Lead Time</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          FR {deliveryGlobalSummary.fillRatePct == null ? 'N/A' : `${deliveryGlobalSummary.fillRatePct.toFixed(1)}%`} | LT{' '}
          {deliveryGlobalSummary.leadTimeDays == null ? 'N/A' : `${deliveryGlobalSummary.leadTimeDays.toFixed(1)}d`}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {deliveryGlobalSummary.scopeLabel} available data
        </p>
        <p className="text-xs text-slate-600">
          Target FR {deliveryGlobalSummary.fillRateTargetPct == null ? 'N/A' : `${deliveryGlobalSummary.fillRateTargetPct.toFixed(1)}%`} | LT{' '}
          {deliveryGlobalSummary.leadTimeTargetDays == null ? 'N/A' : `${deliveryGlobalSummary.leadTimeTargetDays.toFixed(1)}d`}
        </p>
      </article>
    </div>
  );
}

function DsoInsightsPanel({
  rows,
  channelBrandSignals,
  stockChannelSummaries,
  governmentContractRows,
  deliveryGlobalSummary,
}: {
  rows: DsoScorecardRow[];
  channelBrandSignals: ChannelBrandSignal[];
  stockChannelSummaries: StockChannelSummary[];
  governmentContractRows: Awaited<ReturnType<typeof getCommercialOperationsGovernmentContractProgressRows>>;
  deliveryGlobalSummary: DeliveryGlobalSummary;
}) {
  const normalizeLabel = (value: string) => value.toLowerCase().trim();
  const annualGeneral = rows.find((row) => normalizeLabel(row.groupName) === 'anual / general') ?? null;
  const privateRows = rows.filter((row) => normalizeLabel(row.groupName).includes('privado'));
  const publicRows = rows.filter((row) => normalizeLabel(row.groupName).includes('gobierno'));

  const aggregate = (items: DsoScorecardRow[]) => {
    if (items.length === 0) return { current: null as number | null, target: null as number | null, variance: null as number | null, mom: null as number | null };
    const avg = (values: Array<number | null | undefined>) => {
      const valid = values.filter((v): v is number => v != null && !Number.isNaN(v));
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };
    const current = avg(items.map((i) => i.currentValue));
    const target = avg(items.map((i) => i.target));
    const mom = avg(items.map((i) => i.varianceMoM));
    return {
      current,
      target,
      variance: current != null && target != null ? current - target : null,
      mom,
    };
  };

  const privateAgg = aggregate(privateRows);
  const publicAgg = aggregate(publicRows);

  const bestPrivate = [...privateRows]
    .filter((row) => row.varianceMoM != null && row.varianceMoM < 0)
    .sort((a, b) => (a.varianceMoM as number) - (b.varianceMoM as number))[0] ?? null;
  const riskPrivate = [...privateRows]
    .filter((row) => row.variance != null && row.variance > 0 && row.varianceMoM != null && row.varianceMoM > 0)
    .sort((a, b) => (b.variance as number) - (a.variance as number))[0] ?? null;
  const bestPublic = [...publicRows]
    .filter((row) => row.varianceMoM != null && row.varianceMoM < 0)
    .sort((a, b) => (a.varianceMoM as number) - (b.varianceMoM as number))[0] ?? null;
  const riskPublic = [...publicRows]
    .filter((row) => row.variance != null && row.variance > 0 && row.varianceMoM != null && row.varianceMoM > 0)
    .sort((a, b) => (b.variance as number) - (a.variance as number))[0] ?? null;

  const narrative: string[] = [];
  if (annualGeneral) {
    narrative.push(
      `Total DSO is ${formatOneDecimal(annualGeneral.currentValue)} vs target ${formatOneDecimal(annualGeneral.target)} (${formatSigned(annualGeneral.variance)}), with MoM ${formatSigned(annualGeneral.varianceMoM)}.`,
    );
  }
  if (privateRows.length > 0) {
    narrative.push(
      `Private channel DSO is ${formatOneDecimal(privateAgg.current)} vs target ${formatOneDecimal(privateAgg.target)} (${formatSigned(privateAgg.variance)}), with MoM ${formatSigned(privateAgg.mom)}.`,
    );
    if (bestPrivate || riskPrivate) {
      narrative.push(
        `Private supporting detail: ${bestPrivate ? `${bestPrivate.groupName} improved vs MoM (${formatSigned(bestPrivate.varianceMoM)}). ` : ''}${riskPrivate ? `${riskPrivate.groupName} is above target and worsening (${formatSigned(riskPrivate.variance)} vs target; MoM ${formatSigned(riskPrivate.varianceMoM)}).` : ''}`.trim(),
      );
    }
  }
  if (publicRows.length > 0) {
    narrative.push(
      `Public channel DSO is ${formatOneDecimal(publicAgg.current)} vs target ${formatOneDecimal(publicAgg.target)} (${formatSigned(publicAgg.variance)}), with MoM ${formatSigned(publicAgg.mom)}.`,
    );
    if (bestPublic || riskPublic) {
      narrative.push(
        `Public supporting detail: ${bestPublic ? `${bestPublic.groupName} improved vs MoM (${formatSigned(bestPublic.varianceMoM)}). ` : ''}${riskPublic ? `${riskPublic.groupName} is above target and worsening (${formatSigned(riskPublic.variance)} vs target; MoM ${formatSigned(riskPublic.varianceMoM)}).` : ''}`.trim(),
      );
    }
  }
  if (narrative.length === 0) {
    narrative.push('No conclusive DSO signal was detected at total/channel level in this cut.');
  }

  const totalSummary = stockChannelSummaries.find((item) => item.scope === 'total') ?? null;
  const privateSummary = stockChannelSummaries.find((item) => item.scope === 'private') ?? null;
  const publicSummary = stockChannelSummaries.find((item) => item.scope === 'public') ?? null;

  const channelSupportingLine = (channel: 'Private' | 'Public') => {
    const improves = channelBrandSignals
      .filter((item) => item.channel === channel && item.momDelta != null && (item.momDelta as number) < 0)
      .sort((a, b) => (a.momDelta as number) - (b.momDelta as number))
      .slice(0, 2);
    const worsens = channelBrandSignals
      .filter((item) => item.channel === channel && item.currentDoh != null && item.targetDoh != null && item.momDelta != null)
      .filter((item) => (item.currentDoh as number) > (item.targetDoh as number) && (item.momDelta as number) > 0)
      .sort((a, b) => (b.currentDoh as number) - (a.currentDoh as number))
      .slice(0, 2);
    const improvingNames = improves.map((item) => item.segment).join(', ');
    const worseningNames = worsens.map((item) => item.segment).join(', ');
    if (!improvingNames && !worseningNames) return null;
    if (improvingNames && worseningNames) {
      return `${channel} supporting detail: ${improvingNames} improved vs MoM; however ${worseningNames} remain above target with worsening trend.`;
    }
    if (improvingNames) return `${channel} supporting detail: ${improvingNames} improved vs MoM.`;
    return `${channel} supporting detail: ${worseningNames} remain above target with worsening trend.`;
  };

  const dohNarrative: string[] = [];
  if (totalSummary) {
    dohNarrative.push(
      `Total DOH is ${formatOneDecimal(totalSummary.currentDoh)} vs target ${formatOneDecimal(totalSummary.targetDoh)} (${formatSigned(totalSummary.variance)}), with MoM ${formatSigned(totalSummary.momDelta)}.`,
    );
  }
  if (privateSummary) {
    dohNarrative.push(
      `Private market DOH is ${formatOneDecimal(privateSummary.currentDoh)} vs target ${formatOneDecimal(privateSummary.targetDoh)} (${formatSigned(privateSummary.variance)}), MoM ${formatSigned(privateSummary.momDelta)}.`,
    );
    const line = channelSupportingLine('Private');
    if (line) dohNarrative.push(line);
  }
  if (publicSummary) {
    dohNarrative.push(
      `Public market DOH is ${formatOneDecimal(publicSummary.currentDoh)} vs target ${formatOneDecimal(publicSummary.targetDoh)} (${formatSigned(publicSummary.variance)}), MoM ${formatSigned(publicSummary.momDelta)}.`,
    );
    const line = channelSupportingLine('Public');
    if (line) dohNarrative.push(line);
  }
  if (dohNarrative.length === 0) {
    dohNarrative.push('No conclusive DOH signal was detected at total/channel level in this cut.');
  }

  const governmentCurrentYear = (() => {
    const anchor =
      governmentContractRows
        .map((row) => row.reportPeriodMonth)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ??
      governmentContractRows
        .map((row) => row.latestPeriodMonth)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ??
      null;
    if (!anchor) return null;
    const parsed = new Date(`${anchor}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getUTCFullYear();
  })();
  const governmentPreviousYear = governmentCurrentYear != null ? governmentCurrentYear - 1 : null;
  const governmentYearPrefix = governmentCurrentYear != null ? `${governmentCurrentYear}-` : null;

  const buildProgressByBU = (stage: 'ordenado' | 'entregado' | 'facturado') => {
    const stageRows = governmentContractRows.filter((row) => normalizeGovernmentStage(row.category) === stage);
    if (stageRows.length === 0) return [] as Array<{
      bu: string;
      deliveredYtd: number;
      maxCy: number;
      progressPct: number | null;
      targetPct: number | null;
      variancePp: number | null;
    }>;
    const denominatorSnapshotMonth =
      stageRows
        .map((row) => row.periodMonth)
        .filter((value) => Boolean(value))
        .sort()
        .at(0) ?? null;
    const ytdRows = stageRows.filter(
      (row) => row.isYtd && (!governmentYearPrefix || row.periodMonth.startsWith(governmentYearPrefix)),
    );
    const targetPct = (() => {
      const months = new Set(ytdRows.map((row) => row.periodMonth)).size;
      return months > 0 ? (months / 12) * 100 : null;
    })();
    const deliveredByBu = new Map<string, number>();
    for (const row of ytdRows) {
      const bu = (row.businessUnit ?? 'Unassigned').trim() || 'Unassigned';
      deliveredByBu.set(bu, (deliveredByBu.get(bu) ?? 0) + row.deliveredQuantity);
    }
    const maxByBu = new Map<string, number>();
    for (const row of denominatorSnapshotMonth ? stageRows.filter((item) => item.periodMonth === denominatorSnapshotMonth) : []) {
      const bu = (row.businessUnit ?? 'Unassigned').trim() || 'Unassigned';
      const maxCy = row.maxQuantity2026Safe ?? row.maxQuantity2026 ?? 0;
      maxByBu.set(bu, (maxByBu.get(bu) ?? 0) + maxCy);
    }
    const bus = new Set<string>([...deliveredByBu.keys(), ...maxByBu.keys()]);
    return [...bus]
      .map((bu) => {
        const deliveredYtd = deliveredByBu.get(bu) ?? 0;
        const maxCy = maxByBu.get(bu) ?? 0;
        const progressPct = maxCy > 0 ? (deliveredYtd / maxCy) * 100 : null;
        return {
          bu,
          deliveredYtd,
          maxCy,
          progressPct,
          targetPct,
          variancePp: progressPct != null && targetPct != null ? progressPct - targetPct : null,
        };
      })
      .sort((a, b) => (b.progressPct ?? -Infinity) - (a.progressPct ?? -Infinity));
  };

  const deliveredByBu = buildProgressByBU('entregado');
  const orderedByBu = buildProgressByBU('ordenado');
  const invoicedByBu = buildProgressByBU('facturado');
  const bestBu = [...deliveredByBu]
    .filter((row) => row.variancePp != null)
    .sort((a, b) => (b.variancePp ?? -Infinity) - (a.variancePp ?? -Infinity))[0] ?? null;
  const worstBu = [...deliveredByBu]
    .filter((row) => row.variancePp != null)
    .sort((a, b) => (a.variancePp ?? Infinity) - (b.variancePp ?? Infinity))[0] ?? null;

  const topDeliveredBrandInBu = (bu: string) => {
    const rows = governmentContractRows.filter(
      (row) =>
        normalizeGovernmentStage(row.category) === 'entregado' &&
        (row.businessUnit ?? 'Unassigned').trim() === bu &&
        row.isYtd &&
        (!governmentYearPrefix || row.periodMonth.startsWith(governmentYearPrefix)),
    );
    const byBrand = new Map<string, number>();
    rows.forEach((row) => {
      const brand = (row.brandName ?? row.canonicalProductName ?? row.sourceProductRaw ?? 'Unassigned').trim() || 'Unassigned';
      byBrand.set(brand, (byBrand.get(brand) ?? 0) + row.deliveredQuantity);
    });
    const top = [...byBrand.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    return top ? { brand: top[0], qty: top[1] } : null;
  };

  const paymentGapByInstitution = (() => {
    const delivered = new Map<string, number>();
    const invoiced = new Map<string, number>();
    governmentContractRows
      .filter((row) => row.isYtd && (!governmentYearPrefix || row.periodMonth.startsWith(governmentYearPrefix)))
      .forEach((row) => {
        const institution = (row.institution ?? 'Unassigned').trim() || 'Unassigned';
        if (normalizeGovernmentStage(row.category) === 'entregado') {
          delivered.set(institution, (delivered.get(institution) ?? 0) + row.deliveredQuantity);
        }
        if (normalizeGovernmentStage(row.category) === 'facturado') {
          invoiced.set(institution, (invoiced.get(institution) ?? 0) + row.deliveredQuantity);
        }
      });
    return [...new Set([...delivered.keys(), ...invoiced.keys()])]
      .map((institution) => {
        const d = delivered.get(institution) ?? 0;
        const f = invoiced.get(institution) ?? 0;
        return { institution, delivered: d, invoiced: f, gap: d - f };
      })
      .filter((row) => row.gap > 0)
      .sort((a, b) => b.gap - a.gap)[0] ?? null;
  })();

  const governmentNarrative: string[] = [];
  const funnelRow = (rowsByBu: Array<{ progressPct: number | null }>) =>
    rowsByBu.length > 0
      ? rowsByBu
          .map((row) => row.progressPct)
          .filter((v): v is number => v != null && !Number.isNaN(v))
          .reduce((a, b, _, arr) => a + b / arr.length, 0)
      : null;
  const orderedProgress = funnelRow(orderedByBu);
  const deliveredProgress = funnelRow(deliveredByBu);
  const invoicedProgress = funnelRow(invoicedByBu);
  if (orderedProgress != null || deliveredProgress != null || invoicedProgress != null) {
    governmentNarrative.push(
      `Funnel ${governmentPreviousYear ?? 'PY'}-${governmentCurrentYear ?? 'CY'}: Ordered ${orderedProgress == null ? 'N/A' : `${orderedProgress.toFixed(1)}%`} -> Delivered ${deliveredProgress == null ? 'N/A' : `${deliveredProgress.toFixed(1)}%`} -> Invoiced ${invoicedProgress == null ? 'N/A' : `${invoicedProgress.toFixed(1)}%`}.`,
    );
  }
  if (bestBu?.variancePp != null) {
    const topBrand = topDeliveredBrandInBu(bestBu.bu);
    governmentNarrative.push(
      `Best BU progression: ${bestBu.bu} at ${bestBu.progressPct?.toFixed(1)}% (${bestBu.variancePp > 0 ? '+' : ''}${bestBu.variancePp.toFixed(1)}pp vs proportional target)${topBrand ? `, led by ${topBrand.brand}` : ''}.`,
    );
  }
  if (worstBu?.variancePp != null) {
    const topBrand = topDeliveredBrandInBu(worstBu.bu);
    governmentNarrative.push(
      `Main BU lag: ${worstBu.bu} at ${worstBu.progressPct?.toFixed(1)}% (${worstBu.variancePp.toFixed(1)}pp vs proportional target)${topBrand ? `, with pressure on ${topBrand.brand}` : ''}.`,
    );
  }
  if (paymentGapByInstitution) {
    governmentNarrative.push(
      `Institution follow-up signal: ${paymentGapByInstitution.institution} shows delivered ${formatInteger(paymentGapByInstitution.delivered)} vs invoiced ${formatInteger(paymentGapByInstitution.invoiced)} (gap ${formatInteger(paymentGapByInstitution.gap)}).`,
    );
  }
  if (governmentNarrative.length === 0) {
    governmentNarrative.push('No conclusive government contract progression signal was detected in this cut.');
  }

  const deliveryNarrative: string[] = [];
  if (deliveryGlobalSummary.fillRatePct != null) {
    deliveryNarrative.push(
      `Public delivery fill rate is ${deliveryGlobalSummary.fillRatePct.toFixed(1)}% vs target ${
        deliveryGlobalSummary.fillRateTargetPct == null ? 'N/A' : `${deliveryGlobalSummary.fillRateTargetPct.toFixed(1)}%`
      } (${
        deliveryGlobalSummary.fillRateVariancePp == null
          ? 'N/A'
          : `${deliveryGlobalSummary.fillRateVariancePp > 0 ? '+' : ''}${deliveryGlobalSummary.fillRateVariancePp.toFixed(1)}pp`
      }).`,
    );
  }
  if (deliveryGlobalSummary.leadTimeDays != null) {
    deliveryNarrative.push(
      `Public lead time is ${deliveryGlobalSummary.leadTimeDays.toFixed(1)} days vs target ${
        deliveryGlobalSummary.leadTimeTargetDays == null
          ? 'N/A'
          : `${deliveryGlobalSummary.leadTimeTargetDays.toFixed(1)} days`
      } (${
        deliveryGlobalSummary.leadTimeVarianceDays == null
          ? 'N/A'
          : `${deliveryGlobalSummary.leadTimeVarianceDays > 0 ? '+' : ''}${deliveryGlobalSummary.leadTimeVarianceDays.toFixed(1)} days`
      }).`,
    );
  }
  if (
    deliveryGlobalSummary.fillRateVariancePp != null &&
    deliveryGlobalSummary.leadTimeVarianceDays != null
  ) {
    const fillOk = deliveryGlobalSummary.fillRateVariancePp >= 0;
    const leadOk = deliveryGlobalSummary.leadTimeVarianceDays <= 0;
    if (fillOk && leadOk) {
      deliveryNarrative.push('Public delivery execution is on-track on both service (fill rate) and responsiveness (lead time).');
    } else if (!fillOk && !leadOk) {
      deliveryNarrative.push('Public delivery execution is under pressure on both fill rate and lead time; service recovery should be prioritized.');
    } else {
      deliveryNarrative.push('Public delivery execution shows mixed performance between fill rate and lead time; focus on the lagging KPI.');
    }
  }
  if (deliveryNarrative.length === 0) {
    deliveryNarrative.push('No conclusive public delivery signal was detected in this cut.');
  }

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-indigo-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-indigo-700">DSO Narrative</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {narrative.map((item) => (
            <p key={`n-${item}`}>- {item}</p>
          ))}
        </div>
      </article>

      <article className="rounded-[24px] border border-cyan-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-cyan-700">DOH Narrative</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {dohNarrative.map((item) => (
            <p key={`doh-${item}`}>- {item}</p>
          ))}
        </div>
      </article>

      <article className="rounded-[24px] border border-fuchsia-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-fuchsia-700">Government Progress Narrative</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {governmentNarrative.map((item) => (
            <p key={`gov-${item}`}>- {item}</p>
          ))}
        </div>
      </article>

      <article className="rounded-[24px] border border-emerald-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Delivery Narrative</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          {deliveryNarrative.map((item) => (
            <p key={`del-${item}`}>- {item}</p>
          ))}
        </div>
      </article>
    </div>
  );
}

function DsoScorecardPanel({
  rows,
  sources,
  channelBrandSignals,
  governmentContractRows,
}: {
  rows: DsoScorecardRow[];
  sources: Awaited<ReturnType<typeof getCommercialOperationsAuditSources>>;
  channelBrandSignals: ChannelBrandSignal[];
  governmentContractRows: Awaited<ReturnType<typeof getCommercialOperationsGovernmentContractProgressRows>>;
}) {
  const veryDeviated = rows.filter((row) => row.variance != null && row.variance > 20);
  const controlledDeviation = rows.filter((row) => row.variance != null && row.variance > 0 && row.variance <= 20);
  const onTrack = rows.filter((row) => row.variance != null && row.variance <= 0);
  const noTarget = rows.filter((row) => row.target == null || row.variance == null);

  const working: string[] = [];
  const improve: string[] = [];
  const actions: string[] = [];

  const governmentYearPrefix = (() => {
    const anchor =
      governmentContractRows
        .map((row) => row.reportPeriodMonth)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ??
      governmentContractRows
        .map((row) => row.latestPeriodMonth)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ??
      null;
    if (!anchor) return null;
    const parsed = new Date(`${anchor}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getUTCFullYear()}-`;
  })();

  const stageSummary = (stage: 'ordenado' | 'entregado' | 'facturado') => {
    const stageRows = governmentContractRows.filter((row) => normalizeGovernmentStage(row.category) === stage);
    if (stageRows.length === 0) return null;
    const denominatorSnapshotMonth =
      stageRows
        .map((row) => row.periodMonth)
        .filter((value) => Boolean(value))
        .sort()
        .at(0) ?? null;
    const denominatorRows = denominatorSnapshotMonth
      ? stageRows.filter((row) => row.periodMonth === denominatorSnapshotMonth)
      : [];
    const deliveredYtd = stageRows
      .filter((row) => row.isYtd && (!governmentYearPrefix || row.periodMonth.startsWith(governmentYearPrefix)))
      .reduce((sum, row) => sum + row.deliveredQuantity, 0);
    const max2026 = denominatorRows.reduce((sum, row) => sum + (row.maxQuantity2026Safe ?? row.maxQuantity2026 ?? 0), 0);
    const progress2026Pct = max2026 > 0 ? (deliveredYtd / max2026) * 100 : null;
    const ytdMonths = new Set(
      stageRows
        .filter((row) => row.isYtd && (!governmentYearPrefix || row.periodMonth.startsWith(governmentYearPrefix)))
        .map((row) => row.periodMonth),
    ).size;
    const target2026Pct = ytdMonths > 0 ? (ytdMonths / 12) * 100 : null;
    return {
      stage,
      deliveredYtd,
      max2026,
      progress2026Pct,
      target2026Pct,
      variancePp:
        progress2026Pct != null && target2026Pct != null ? progress2026Pct - target2026Pct : null,
    };
  };

  const buildProgressByDimension = (
    stage: 'ordenado' | 'entregado' | 'facturado',
    keySelector: (row: Awaited<ReturnType<typeof getCommercialOperationsGovernmentContractProgressRows>>[number]) => string,
  ) => {
    const stageRows = governmentContractRows.filter((row) => normalizeGovernmentStage(row.category) === stage);
    if (stageRows.length === 0) return [] as Array<{
      key: string;
      deliveredYtd: number;
      max2026: number;
      progress2026Pct: number | null;
      target2026Pct: number | null;
      variancePp: number | null;
    }>;

    const denominatorSnapshotMonth =
      stageRows
        .map((row) => row.periodMonth)
        .filter((value) => Boolean(value))
        .sort()
        .at(0) ?? null;
    const ytdRows = stageRows.filter(
      (row) => row.isYtd && (!governmentYearPrefix || row.periodMonth.startsWith(governmentYearPrefix)),
    );
    const target2026Pct = (() => {
      const months = new Set(ytdRows.map((row) => row.periodMonth)).size;
      return months > 0 ? (months / 12) * 100 : null;
    })();

    const deliveredByKey = new Map<string, number>();
    for (const row of ytdRows) {
      const key = keySelector(row) || 'Unassigned';
      deliveredByKey.set(key, (deliveredByKey.get(key) ?? 0) + row.deliveredQuantity);
    }

    const maxByKey = new Map<string, number>();
    for (const row of denominatorSnapshotMonth ? stageRows.filter((item) => item.periodMonth === denominatorSnapshotMonth) : []) {
      const key = keySelector(row) || 'Unassigned';
      const max2026 = row.maxQuantity2026Safe ?? row.maxQuantity2026 ?? 0;
      maxByKey.set(key, (maxByKey.get(key) ?? 0) + max2026);
    }

    const keys = new Set<string>([...deliveredByKey.keys(), ...maxByKey.keys()]);
    return [...keys].map((key) => {
      const deliveredYtd = deliveredByKey.get(key) ?? 0;
      const max2026 = maxByKey.get(key) ?? 0;
      const progress2026Pct = max2026 > 0 ? (deliveredYtd / max2026) * 100 : null;
      return {
        key,
        deliveredYtd,
        max2026,
        progress2026Pct,
        target2026Pct,
        variancePp:
          progress2026Pct != null && target2026Pct != null ? progress2026Pct - target2026Pct : null,
      };
    });
  };

  const orderedSummary = stageSummary('ordenado');
  const deliveredSummary = stageSummary('entregado');
  const invoicedSummary = stageSummary('facturado');
  const deliveredByInstitution = buildProgressByDimension('entregado', (row) => (row.institution ?? '').trim());
  const deliveredByBrand = buildProgressByDimension(
    'entregado',
    (row) => `${(row.marketGroup ?? 'Unassigned').trim()} - ${(row.brandName ?? row.canonicalProductName ?? row.sourceProductRaw ?? 'Unassigned').trim()}`,
  );

  const institutionGaps = deliveredByInstitution
    .filter((row) => row.progress2026Pct != null && row.target2026Pct != null)
    .sort((a, b) => (a.variancePp ?? 0) - (b.variancePp ?? 0));
  const brandGaps = deliveredByBrand
    .filter((row) => row.progress2026Pct != null && row.target2026Pct != null)
    .sort((a, b) => (a.variancePp ?? 0) - (b.variancePp ?? 0));
  const institutionsAhead = [...institutionGaps].reverse().filter((row) => (row.variancePp ?? -Infinity) >= 0);
  const institutionsLagging = institutionGaps.filter((row) => (row.variancePp ?? Infinity) < 0);
  const brandsAhead = [...brandGaps].reverse().filter((row) => (row.variancePp ?? -Infinity) >= 0);
  const brandsLagging = brandGaps.filter((row) => (row.variancePp ?? Infinity) < 0);

  const ytdQtyByInstitution = (stage: 'entregado' | 'facturado') => {
    const map = new Map<string, number>();
    governmentContractRows
      .filter(
        (row) =>
          normalizeGovernmentStage(row.category) === stage &&
          row.isYtd &&
          (!governmentYearPrefix || row.periodMonth.startsWith(governmentYearPrefix)),
      )
      .forEach((row) => {
        const key = (row.institution ?? '').trim() || 'Unassigned';
        map.set(key, (map.get(key) ?? 0) + row.deliveredQuantity);
      });
    return map;
  };
  const deliveredQtyByInstitution = ytdQtyByInstitution('entregado');
  const invoicedQtyByInstitution = ytdQtyByInstitution('facturado');
  const paymentGapByInstitution = [...new Set([...deliveredQtyByInstitution.keys(), ...invoicedQtyByInstitution.keys()])]
    .map((institution) => {
      const delivered = deliveredQtyByInstitution.get(institution) ?? 0;
      const invoiced = invoicedQtyByInstitution.get(institution) ?? 0;
      return { institution, delivered, invoiced, gap: delivered - invoiced };
    })
    .filter((row) => row.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  const orderedByInstitution = buildProgressByDimension('ordenado', (row) => (row.institution ?? '').trim());
  const deliveredByInstitutionMap = new Map(deliveredByInstitution.map((item) => [item.key, item]));
  const orderedDeliveredDelta = orderedByInstitution
    .map((ordered) => {
      const delivered = deliveredByInstitutionMap.get(ordered.key);
      if (ordered.progress2026Pct == null || delivered?.progress2026Pct == null) return null;
      return {
        institution: ordered.key,
        orderedProgress: ordered.progress2026Pct,
        deliveredProgress: delivered.progress2026Pct,
        deltaPp: delivered.progress2026Pct - ordered.progress2026Pct,
      };
    })
    .filter((row): row is { institution: string; orderedProgress: number; deliveredProgress: number; deltaPp: number } => Boolean(row));
  const avgOrderedDeliveredDelta =
    orderedDeliveredDelta.length > 0
      ? orderedDeliveredDelta.reduce((sum, row) => sum + row.deltaPp, 0) / orderedDeliveredDelta.length
      : null;
  const orderedDeliveredRisks = orderedDeliveredDelta
    .filter((row) => avgOrderedDeliveredDelta != null && row.deltaPp < avgOrderedDeliveredDelta)
    .sort((a, b) => a.deltaPp - b.deltaPp);

  if (onTrack.length > 0) {
    const best = [...onTrack].sort((a, b) => (a.variance ?? 0) - (b.variance ?? 0))[0];
    working.push(
      `${best.groupName} is below target by ${formatSigned(best.variance)} days (current ${best.currentValue?.toFixed(1) ?? 'N/A'} vs target ${best.target?.toFixed(1) ?? 'N/A'}).`,
    );
  }

  const improvedVsPy = rows.filter((row) => row.varianceVsPy != null && row.varianceVsPy < 0);
  const improvedMoM = rows.filter((row) => row.varianceMoM != null && row.varianceMoM < 0);
  const worsenedMoM = rows.filter((row) => row.varianceMoM != null && row.varianceMoM > 0);
  const improvedYtdAvg = rows.filter((row) => row.varianceYtdAvgVsPy != null && row.varianceYtdAvgVsPy < 0);
  const worsenedYtdAvg = rows.filter((row) => row.varianceYtdAvgVsPy != null && row.varianceYtdAvgVsPy > 0);
  if (improvedVsPy.length > 0) {
    const leader = [...improvedVsPy].sort((a, b) => (a.varianceVsPy ?? 0) - (b.varianceVsPy ?? 0))[0];
    working.push(
      `${leader.groupName} improved vs PY by ${Math.abs(leader.varianceVsPy ?? 0).toFixed(1)} days, supporting healthier collection cycle.`,
    );
  }
  if (improvedMoM.length > 0) {
    const leaderMoM = [...improvedMoM].sort((a, b) => (a.varianceMoM ?? 0) - (b.varianceMoM ?? 0))[0];
    working.push(`${leaderMoM.groupName} improved MoM by ${Math.abs(leaderMoM.varianceMoM ?? 0).toFixed(1)} days.`);
  }
  if (improvedYtdAvg.length > 0) {
    const leaderYtd = [...improvedYtdAvg].sort((a, b) => (a.varianceYtdAvgVsPy ?? 0) - (b.varianceYtdAvgVsPy ?? 0))[0];
    working.push(`${leaderYtd.groupName} improved YTD average vs LY by ${Math.abs(leaderYtd.varianceYtdAvgVsPy ?? 0).toFixed(1)} days.`);
  }

  if (veryDeviated.length > 0) {
    const topVeryDeviated = veryDeviated
      .sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0))
      .slice(0, 3);
    improve.push(
      `Very deviated groups: ${topVeryDeviated
        .map((row) => `${row.groupName} (+${(row.variance ?? 0).toFixed(1)} days)`)
        .join(' | ')} vs target.`,
    );
  }

  if (controlledDeviation.length > 0) {
    controlledDeviation
      .sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0))
      .slice(0, 2)
      .forEach((row) => {
        improve.push(`${row.groupName} shows controlled deviation (+${(row.variance ?? 0).toFixed(1)} days vs target).`);
      });
  }
  if (worsenedMoM.length > 0) {
    const worstMoM = [...worsenedMoM].sort((a, b) => (b.varianceMoM ?? 0) - (a.varianceMoM ?? 0))[0];
    improve.push(`${worstMoM.groupName} is worsening MoM (+${(worstMoM.varianceMoM ?? 0).toFixed(1)} days).`);
  }
  if (worsenedYtdAvg.length > 0) {
    const worstYtd = [...worsenedYtdAvg].sort((a, b) => (b.varianceYtdAvgVsPy ?? 0) - (a.varianceYtdAvgVsPy ?? 0))[0];
    improve.push(`${worstYtd.groupName} is worsening on YTD average vs LY (+${(worstYtd.varianceYtdAvgVsPy ?? 0).toFixed(1)} days).`);
  }

  if (veryDeviated.length > 0) {
    actions.push('Launch focused overdue-collection sprint for very deviated groups with weekly governance and account-level owners.');
  }
  if (controlledDeviation.length > 0) {
    actions.push('Deploy controlled correction plan for moderate gaps to prevent drift into high-risk DSO territory.');
  }
  if (onTrack.length > 0) {
    actions.push('Replicate on-track collection practices across deviated groups to standardize payment discipline.');
  }
  if (worsenedMoM.length > 0 || worsenedYtdAvg.length > 0) {
    actions.push('Add MoM and YTD-vs-LY DSO checkpoints in weekly operating rhythm to detect deterioration earlier.');
  }

  if (working.length === 0) working.push('No group is currently below target in this cut.');
  if (improve.length === 0) improve.push('No material DSO deviation was detected in this cut.');
  if (actions.length === 0) actions.push('Maintain current cadence and monitor DSO trend weekly.');

  const healthySignals = channelBrandSignals
    .filter((item) => item.status === 'healthy')
    .sort((a, b) => (a.currentDoh ?? 0) - (b.currentDoh ?? 0));
  const riskSignals = channelBrandSignals
    .filter((item) => item.status === 'risk')
    .sort((a, b) => (b.currentDoh ?? 0) - (a.currentDoh ?? 0));

  const dohScoped = channelBrandSignals.filter(
    (item) => item.currentDoh != null && item.targetDoh != null && item.momDelta != null,
  );
  const dohScaleUp = dohScoped
    .filter((item) => (item.currentDoh as number) <= (item.targetDoh as number) && (item.momDelta as number) <= 0)
    .sort((a, b) => (a.currentDoh as number) - (b.currentDoh as number))
    .slice(0, 4);
  const dohWatchlist = dohScoped
    .filter((item) => (item.currentDoh as number) <= (item.targetDoh as number) && (item.momDelta as number) > 0)
    .sort((a, b) => (b.momDelta as number) - (a.momDelta as number))
    .slice(0, 4);
  const dohRecover = dohScoped
    .filter((item) => (item.currentDoh as number) > (item.targetDoh as number) && (item.momDelta as number) <= 0)
    .sort((a, b) => (a.momDelta as number) - (b.momDelta as number))
    .slice(0, 4);
  const dohCritical = dohScoped
    .filter((item) => (item.currentDoh as number) > (item.targetDoh as number) && (item.momDelta as number) > 0)
    .sort((a, b) => (b.currentDoh as number) - (a.currentDoh as number))
    .slice(0, 4);

  healthySignals.slice(0, 2).forEach((item) => {
    working.push(
      `[DOH] ${item.channel} | ${item.segment}: healthy DOH (${formatOneDecimal(item.currentDoh)}) and improving trend (${formatSigned(item.momDelta)} vs MoM).`,
    );
  });
  riskSignals.slice(0, 3).forEach((item) => {
    improve.push(
      `[DOH] ${item.channel} | ${item.segment}: unhealthy DOH (${formatOneDecimal(item.currentDoh)}), above target ${formatOneDecimal(item.targetDoh)} and increasing MoM.`,
    );
  });
  if (riskSignals.length > 0) {
    actions.push(
      '[DOH] Prioritize recovery in risk segments by channel (reduce stock exposure and stabilize sell-out cadence in above-target/increasing DOH items).',
    );
  }

  if (deliveredSummary?.variancePp != null) {
    if (deliveredSummary.variancePp >= 0) {
      working.push(
        `[GCP] Delivered progress is above proportional target by +${deliveredSummary.variancePp.toFixed(1)}pp (${deliveredSummary.progress2026Pct?.toFixed(1)}% vs target ${deliveredSummary.target2026Pct?.toFixed(1)}%).`,
      );
    } else {
      improve.push(
        `[GCP] Delivered progress is below proportional target by ${deliveredSummary.variancePp.toFixed(1)}pp (${deliveredSummary.progress2026Pct?.toFixed(1)}% vs target ${deliveredSummary.target2026Pct?.toFixed(1)}%).`,
      );
    }
  }
  if (institutionsAhead.length > 0) {
    const leader = institutionsAhead[0];
    working.push(
      `[GCP] Institution ahead of target: ${leader.key} (${leader.progress2026Pct?.toFixed(1)}%, ${leader.variancePp != null ? `${leader.variancePp > 0 ? '+' : ''}${leader.variancePp.toFixed(1)}pp` : 'N/A'} vs target).`,
    );
  }
  if (brandsAhead.length > 0) {
    const leader = brandsAhead[0];
    working.push(
      `[GCP] Brand ahead of target: ${leader.key} (${leader.progress2026Pct?.toFixed(1)}%, ${leader.variancePp != null ? `${leader.variancePp > 0 ? '+' : ''}${leader.variancePp.toFixed(1)}pp` : 'N/A'}).`,
    );
  }
  institutionsLagging.slice(0, 2).forEach((row) => {
    return row;
  });
  if (institutionsLagging.length > 0) {
    const topInstitutionLagging = institutionsLagging.slice(0, 3);
    improve.push(
      `[GCP] Institutions lagging target: ${topInstitutionLagging
        .map((row) => `${row.key} (${row.progress2026Pct?.toFixed(1)}%, ${row.variancePp?.toFixed(1)}pp)`)
        .join(' | ')}.`,
    );
  }
  if (brandsLagging.length > 0) {
    const topBrandLagging = brandsLagging.slice(0, 3);
    improve.push(
      `[GCP] Brands lagging target: ${topBrandLagging
        .map((row) => `${row.key} (${row.progress2026Pct?.toFixed(1)}%, ${row.variancePp?.toFixed(1)}pp)`)
        .join(' | ')}.`,
    );
  }

  if (paymentGapByInstitution.length > 0) {
    const worstGap = paymentGapByInstitution[0];
    improve.push(
      `[GCP] Potential pending payment proxy: ${worstGap.institution} has delivered ${formatInteger(worstGap.delivered)} vs invoiced ${formatInteger(worstGap.invoiced)} (gap ${formatInteger(worstGap.gap)}).`,
    );
    actions.push(
      '[GCP] Prioritize collection follow-up where delivered is materially above invoiced to reduce working-capital exposure.',
    );
  }

  if (orderedDeliveredRisks.length > 0) {
    const highestRisk = orderedDeliveredRisks[0];
    improve.push(
      `[GCP] Conversion risk: ${highestRisk.institution} shows lower delivered progress than ordered progress (${highestRisk.orderedProgress.toFixed(1)}% -> ${highestRisk.deliveredProgress.toFixed(1)}%).`,
    );
    actions.push(
      '[GCP] Focus execution on contracts where ordered progression materially outpaces delivered progression.',
    );
  }
  if (orderedSummary?.progress2026Pct != null && deliveredSummary?.progress2026Pct != null && invoicedSummary?.progress2026Pct != null) {
    working.push(
      `[GCP] Funnel visibility enabled: Ordered ${orderedSummary.progress2026Pct.toFixed(1)}% -> Delivered ${deliveredSummary.progress2026Pct.toFixed(1)}% -> Invoiced ${invoicedSummary.progress2026Pct.toFixed(1)}%.`,
    );
  }
  const workingTagged = working.map(tagMetricLine);
  const improveTagged = improve.map(tagMetricLine);
  const actionsTagged = actions.map(tagMetricLine);

  return (
    <div className="space-y-4">
      <article className="rounded-[24px] border border-indigo-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-indigo-700">DSO Performance Map</p>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            Target Deviation Bands
          </p>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          <div className="rounded-[14px] border border-rose-200 bg-rose-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Very Deviated</p>
            <p className="mt-1 text-xs text-rose-900">Variance &gt; +20 days vs target.</p>
            <p className="mt-2 text-2xl font-semibold text-rose-700">{veryDeviated.length}</p>
            <div className="mt-2 space-y-1">
              {veryDeviated.slice(0, 3).map((item) => (
                <p key={`vd-${item.groupName}`} className="text-xs text-slate-700">
                  {item.groupName} ({formatSigned(item.variance)})
                </p>
              ))}
              {veryDeviated.length === 0 ? <p className="text-xs text-slate-600">No groups.</p> : null}
            </div>
          </div>
          <div className="rounded-[14px] border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Controlled Deviation</p>
            <p className="mt-1 text-xs text-amber-900">Variance between +0 and +20 days.</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">{controlledDeviation.length}</p>
            <div className="mt-2 space-y-1">
              {controlledDeviation.slice(0, 3).map((item) => (
                <p key={`cd-${item.groupName}`} className="text-xs text-slate-700">
                  {item.groupName} ({formatSigned(item.variance)})
                </p>
              ))}
              {controlledDeviation.length === 0 ? <p className="text-xs text-slate-600">No groups.</p> : null}
            </div>
          </div>
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">On Track</p>
            <p className="mt-1 text-xs text-emerald-900">At or below target (variance &lt;= 0).</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">{onTrack.length}</p>
            <div className="mt-2 space-y-1">
              {onTrack.slice(0, 3).map((item) => (
                <p key={`ot-${item.groupName}`} className="text-xs text-slate-700">
                  {item.groupName} ({formatSigned(item.variance)})
                </p>
              ))}
              {onTrack.length === 0 ? <p className="text-xs text-slate-600">No groups.</p> : null}
            </div>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">No Target</p>
            <p className="mt-1 text-xs text-slate-900">Groups without active target mapping.</p>
            <p className="mt-2 text-2xl font-semibold text-slate-700">{noTarget.length}</p>
            <div className="mt-2 space-y-1">
              {noTarget.slice(0, 3).map((item) => (
                <p key={`nt-${item.groupName}`} className="text-xs text-slate-700">
                  {item.groupName}
                </p>
              ))}
              {noTarget.length === 0 ? <p className="text-xs text-slate-600">No groups.</p> : null}
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-cyan-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-700">DOH Performance Map</p>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            Target x MoM by Channel-Product
          </p>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Scale Up</p>
            <p className="mt-1 text-xs text-emerald-900">Below target and improving MoM.</p>
            <div className="mt-2 space-y-1">
              {dohScaleUp.length === 0 ? <p className="text-xs text-slate-600">No items.</p> : null}
              {dohScaleUp.map((item) => (
                <div key={`su-${item.channel}-${item.segment}`} className="flex items-center gap-2 text-xs text-slate-700">
                  <ChannelBadge channel={item.channel} />
                  <p>
                    {item.segment} · DOH {formatOneDecimal(item.currentDoh)} · MoM {formatSigned(item.momDelta)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Watchlist</p>
            <p className="mt-1 text-xs text-amber-900">Below target but worsening MoM.</p>
            <div className="mt-2 space-y-1">
              {dohWatchlist.length === 0 ? <p className="text-xs text-slate-600">No items.</p> : null}
              {dohWatchlist.map((item) => (
                <div key={`wl-${item.channel}-${item.segment}`} className="flex items-center gap-2 text-xs text-slate-700">
                  <ChannelBadge channel={item.channel} />
                  <p>
                    {item.segment} · DOH {formatOneDecimal(item.currentDoh)} · MoM {formatSigned(item.momDelta)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] border border-sky-200 bg-sky-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Recover</p>
            <p className="mt-1 text-xs text-sky-900">Above target but improving MoM.</p>
            <div className="mt-2 space-y-1">
              {dohRecover.length === 0 ? <p className="text-xs text-slate-600">No items.</p> : null}
              {dohRecover.map((item) => (
                <div key={`rc-${item.channel}-${item.segment}`} className="flex items-center gap-2 text-xs text-slate-700">
                  <ChannelBadge channel={item.channel} />
                  <p>
                    {item.segment} · DOH {formatOneDecimal(item.currentDoh)} · MoM {formatSigned(item.momDelta)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] border border-rose-200 bg-rose-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Critical</p>
            <p className="mt-1 text-xs text-rose-900">Above target and worsening MoM.</p>
            <div className="mt-2 space-y-1">
              {dohCritical.length === 0 ? <p className="text-xs text-slate-600">No items.</p> : null}
              {dohCritical.map((item) => (
                <div key={`cr-${item.channel}-${item.segment}`} className="flex items-center gap-2 text-xs text-slate-700">
                  <ChannelBadge channel={item.channel} />
                  <p>
                    {item.segment} · DOH {formatOneDecimal(item.currentDoh)} · MoM {formatSigned(item.momDelta)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-fuchsia-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-fuchsia-700">Government Contract Funnel</p>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            ORDENADO → ENTREGADO → FACTURADO
          </p>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Ordered Progress 2026</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {orderedSummary?.progress2026Pct == null ? 'N/A' : `${orderedSummary.progress2026Pct.toFixed(1)}%`}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Target {orderedSummary?.target2026Pct == null ? 'N/A' : `${orderedSummary.target2026Pct.toFixed(1)}%`}
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Delivered Progress 2026</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {deliveredSummary?.progress2026Pct == null ? 'N/A' : `${deliveredSummary.progress2026Pct.toFixed(1)}%`}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Target {deliveredSummary?.target2026Pct == null ? 'N/A' : `${deliveredSummary.target2026Pct.toFixed(1)}%`}
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Invoiced Progress 2026</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {invoicedSummary?.progress2026Pct == null ? 'N/A' : `${invoicedSummary.progress2026Pct.toFixed(1)}%`}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Target {invoicedSummary?.target2026Pct == null ? 'N/A' : `${invoicedSummary.target2026Pct.toFixed(1)}%`}
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">Funnel Ratios</p>
            <p className="mt-2 text-sm text-slate-800">
              ENT/ORD:{' '}
              {orderedSummary?.progress2026Pct && deliveredSummary?.progress2026Pct
                ? `${((deliveredSummary.progress2026Pct / orderedSummary.progress2026Pct) * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
            <p className="mt-1 text-sm text-slate-800">
              FAC/ENT:{' '}
              {deliveredSummary?.progress2026Pct && invoicedSummary?.progress2026Pct
                ? `${((invoicedSummary.progress2026Pct / deliveredSummary.progress2026Pct) * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
            <p className="mt-1 text-sm text-slate-800">
              FAC/ORD:{' '}
              {orderedSummary?.progress2026Pct && invoicedSummary?.progress2026Pct
                ? `${((invoicedSummary.progress2026Pct / orderedSummary.progress2026Pct) * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
          </div>
        </div>
      </article>

      <ScorecardInsightSections
        working={workingTagged}
        improve={improveTagged}
        actions={actionsTagged}
      />

      <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Audit Context</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((row) => (
            <div key={row.moduleCode} className="rounded-[12px] border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{row.moduleLabel}</p>
              <p className="mt-1 text-sm text-slate-900">{toStatusLabel(row.status)}</p>
              <p className="mt-1 text-xs text-slate-600">Rows: {row.rowsValid ?? 0}/{row.rowsTotal ?? 0}</p>
              <p className="text-xs text-slate-600">As of: {formatMonth(row.sourceAsOfMonth)}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function ModeTabs({ active, params }: { active: CommercialOperationsViewMode; params: SearchParams }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['insights', 'scorecard', 'dashboard'] as const).map((mode) => {
        const isActive = active === mode;
        return (
          <Link
            key={mode}
            href={modeHref(mode, params)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              isActive
                ? 'bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.35)]'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            {mode}
          </Link>
        );
      })}
    </div>
  );
}

export async function CommercialOperationsView({
  viewMode,
  searchParams,
}: {
  viewMode: CommercialOperationsViewMode;
  searchParams?: SearchParams;
}) {
  const versions = await getReportingVersions();
  const selectedVersion = versions.find((item) => item.reportingVersionId === searchParams?.version) ?? versions[0];
  const selectedReportingVersionId = selectedVersion?.reportingVersionId ?? '';
  const selectedPeriodMonth = selectedVersion?.periodMonth ?? '';

  const getSourcesCached = unstable_cache(
    async (reportingVersionId: string) => getCommercialOperationsAuditSources(reportingVersionId || undefined),
    [`commercial-operations-sources-${selectedReportingVersionId}`],
    {
      revalidate: 600,
      tags: ['commercial-operations'],
    },
  );

  const sources = await getSourcesCached(selectedReportingVersionId);
  const reportPeriodMonth = sources.map((row) => row.reportPeriodMonth).filter(Boolean).sort().at(-1) ?? null;
  const sourceAsOfMonth = sources.map((row) => row.sourceAsOfMonth).filter(Boolean).sort().at(-1) ?? null;
  const publishedCount = sources.filter((row) => row.status === 'published').length;

  const [dsoOverviewRows, targetRows, stockRows, governmentContractRows, deliveryOrderRows] = await Promise.all([
    getCommercialOperationsDsoOverview(selectedReportingVersionId || undefined),
    getAdminTargets('commercial_operations', selectedReportingVersionId || undefined, selectedPeriodMonth || undefined),
    getCommercialOperationsStocksRows(selectedReportingVersionId || undefined),
    getCommercialOperationsGovernmentContractProgressRows(selectedReportingVersionId || undefined),
    getCommercialOperationsDeliveryOrderRows(selectedReportingVersionId || undefined),
  ]);
  const stockTargets = getCommercialOperationsStockTargets(targetRows);
  const deliveryTargets = getCommercialOperationsDeliveryTargets(targetRows);
  const channelBrandSignals = buildChannelBrandSignals(stockRows, stockTargets);
  const stockTotalSummary = buildStockTotalSummary(stockRows, stockTargets);
  const stockChannelSummaries = buildStockChannelSummaries(stockRows, stockTargets);
  const governmentContractsSummary = buildGovernmentContractsSummary(governmentContractRows);
  const deliveryGlobalSummary = buildDeliveryGlobalSummary(deliveryOrderRows, deliveryTargets);

  const dsoTrendRows =
    viewMode === 'dashboard'
      ? await getCommercialOperationsDsoTrend(selectedReportingVersionId || undefined)
      : [];
  const dsoTableRows = dsoOverviewRows.map((row) => {
    const target = getDsoTargetByGroup(row.groupName, targetRows);
    const currentValue = row.dsoReportPeriod ?? row.dsoMth;
    const previousMonthValue = row.dsoPreviousMonth;
    const momDelta =
      row.deltaVsMoM != null ? row.deltaVsMoM : currentValue != null && previousMonthValue != null ? currentValue - previousMonthValue : null;
    return {
      groupName: row.groupName,
      currentValue,
      previousMonthValue,
      momDelta,
      ytdAvg: row.dsoYtdAvg,
      ytdAvgPy: row.dsoYtdAvgPy,
      ytdAvgDelta: row.deltaVsYtdAvgPy != null ? row.deltaVsYtdAvgPy : row.dsoYtdAvg != null && row.dsoYtdAvgPy != null ? row.dsoYtdAvg - row.dsoYtdAvgPy : null,
      target,
      variance: currentValue != null && target != null ? currentValue - target : null,
    };
  });
  const dsoScoreRows: DsoScorecardRow[] = dsoOverviewRows.map((row) => {
    const target = getDsoTargetByGroup(row.groupName, targetRows);
    const currentValue = row.dsoReportPeriod ?? row.dsoMth;
    const previousMonthValue = row.dsoPreviousMonth;
    const pyValue = row.dsoReportPeriodPy ?? row.dsoMthPy;
    return {
      groupName: row.groupName,
      currentValue,
      previousMonthValue,
      varianceMoM:
        row.deltaVsMoM != null
          ? row.deltaVsMoM
          : currentValue != null && previousMonthValue != null
            ? currentValue - previousMonthValue
            : null,
      ytdAvg: row.dsoYtdAvg,
      ytdAvgPy: row.dsoYtdAvgPy,
      varianceYtdAvgVsPy:
        row.deltaVsYtdAvgPy != null
          ? row.deltaVsYtdAvgPy
          : row.dsoYtdAvg != null && row.dsoYtdAvgPy != null
            ? row.dsoYtdAvg - row.dsoYtdAvgPy
            : null,
      target,
      variance: currentValue != null && target != null ? currentValue - target : null,
      pyValue,
      varianceVsPy: currentValue != null && pyValue != null ? currentValue - pyValue : null,
    };
  });

  const params: SearchParams = {
    version: searchParams?.version ?? selectedReportingVersionId,
  };

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden lg:gap-2 xl:gap-3 2xl:gap-4">
      <SectionHeader
        eyebrow="Executive"
        title="Commercial Operations"
        description="DSO monitoring with target alignment and month trend analytics."
        actions={<ModeTabs active={viewMode} params={params} />}
      />

      <div className="min-h-0 overflow-auto">
        {viewMode === 'dashboard' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>{' '}
                {formatMonth(reportPeriodMonth)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Published Sources</span>{' '}
                {publishedCount}/{sources.length}
              </span>
            </div>
            <DsoGlobalCards
              rows={dsoScoreRows}
              stockTotalSummary={stockTotalSummary}
              governmentContractsSummary={governmentContractsSummary}
              deliveryGlobalSummary={deliveryGlobalSummary}
            />

            <DsoDashboardPanel
              overviewRows={dsoOverviewRows}
              trendRows={dsoTrendRows}
              tableRows={dsoTableRows}
              initialGroup="Anual / General"
              stockRows={stockRows}
              governmentContractRows={governmentContractRows}
              deliveryOrderRows={deliveryOrderRows}
              stockTargets={stockTargets}
              deliveryTargets={deliveryTargets}
              contractsSourceAsOfMonth={
                sources.find((row) => row.moduleCode === 'commercial_operations_government_contract_progress')
                  ?.sourceAsOfMonth ?? null
              }
            />
          </div>
        ) : viewMode === 'scorecard' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>{' '}
                {formatMonth(reportPeriodMonth)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>{' '}
                {formatMonth(sourceAsOfMonth)}
              </span>
            </div>
            <DsoGlobalCards
              rows={dsoScoreRows}
              stockTotalSummary={stockTotalSummary}
              governmentContractsSummary={governmentContractsSummary}
              deliveryGlobalSummary={deliveryGlobalSummary}
            />
            <DsoScorecardPanel
              rows={dsoScoreRows}
              sources={sources}
              channelBrandSignals={channelBrandSignals}
              governmentContractRows={governmentContractRows}
            />
          </div>
        ) : viewMode === 'insights' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Report Period</span>{' '}
                {formatMonth(reportPeriodMonth)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>{' '}
                {formatMonth(sourceAsOfMonth)}
              </span>
            </div>
            <DsoGlobalCards
              rows={dsoScoreRows}
              stockTotalSummary={stockTotalSummary}
              governmentContractsSummary={governmentContractsSummary}
              deliveryGlobalSummary={deliveryGlobalSummary}
            />
            <DsoInsightsPanel
              rows={dsoScoreRows}
              channelBrandSignals={channelBrandSignals}
              stockChannelSummaries={stockChannelSummaries}
              governmentContractRows={governmentContractRows}
              deliveryGlobalSummary={deliveryGlobalSummary}
            />
          </div>
        ) : (
          <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
            {viewMode === 'insights'
              ? 'Insights Setup'
              : viewMode === 'scorecard'
                ? 'Scorecard Setup'
                : 'Dashboard Setup'}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Source Readiness Checklist
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            We are waiting for headers and normalization rules. Once each source is uploaded and published, we connect
            analytics immediately.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((source) => (
              <article
                key={source.moduleCode}
                className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{source.moduleLabel}</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                    {toStatusLabel(source.status)}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  Rows: {source.rowsValid ?? 0}/{source.rowsTotal ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-600">Uploaded: {formatDateTime(source.uploadedAt)}</p>
                <p className="mt-1 text-xs text-slate-600">As of: {formatMonth(source.sourceAsOfMonth)}</p>
              </article>
            ))}
          </div>
          </article>
        )}
      </div>
    </section>
  );
}
