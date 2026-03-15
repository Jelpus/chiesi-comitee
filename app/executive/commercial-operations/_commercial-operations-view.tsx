import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { SectionHeader } from '@/components/ui/section-header';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';
import {
  getCommercialOperationsAuditSources,
  getCommercialOperationsDsoOverview,
  getCommercialOperationsDsoTrend,
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
  const cleanText = isDoh ? text.replace('[DOH] ', '') : text;
  return `${isDoh ? 'DOH' : 'DSO'}|||${cleanText}`;
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

function DsoGlobalCards({ rows, stockTotalSummary }: { rows: DsoScorecardRow[]; stockTotalSummary: StockTotalSummary }) {
  const normalizeLabel = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
  const annualGeneral = rows.find((row) => normalizeLabel(row.groupName) === normalizeLabel('Anual / General')) ?? null;
  const trackedGroups = rows.filter((row) => row.target != null).length;
  const onTrackGroups = rows.filter((row) => row.variance != null && row.variance <= 0).length;
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tracked vs Target</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{trackedGroups}</p>
      </article>
      <article className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">On Track (MTH)</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{onTrackGroups}</p>
      </article>
    </div>
  );
}

function DsoInsightsPanel({
  rows,
  channelBrandSignals,
  stockChannelSummaries,
}: {
  rows: DsoScorecardRow[];
  channelBrandSignals: ChannelBrandSignal[];
  stockChannelSummaries: StockChannelSummary[];
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
    </div>
  );
}

function DsoScorecardPanel({
  rows,
  sources,
  channelBrandSignals,
}: {
  rows: DsoScorecardRow[];
  sources: Awaited<ReturnType<typeof getCommercialOperationsAuditSources>>;
  channelBrandSignals: ChannelBrandSignal[];
}) {
  const veryDeviated = rows.filter((row) => row.variance != null && row.variance > 20);
  const controlledDeviation = rows.filter((row) => row.variance != null && row.variance > 0 && row.variance <= 20);
  const onTrack = rows.filter((row) => row.variance != null && row.variance <= 0);
  const noTarget = rows.filter((row) => row.target == null || row.variance == null);

  const working: string[] = [];
  const improve: string[] = [];
  const actions: string[] = [];

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
    veryDeviated
      .sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0))
      .slice(0, 3)
      .forEach((row) => {
        improve.push(`${row.groupName} is very deviated (+${(row.variance ?? 0).toFixed(1)} days vs target).`);
      });
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

  const [dsoOverviewRows, targetRows, stockRows] = await Promise.all([
    getCommercialOperationsDsoOverview(selectedReportingVersionId || undefined),
    getAdminTargets('commercial_operations', selectedReportingVersionId || undefined, selectedPeriodMonth || undefined),
    getCommercialOperationsStocksRows(selectedReportingVersionId || undefined),
  ]);
  const stockTargets = getCommercialOperationsStockTargets(targetRows);
  const channelBrandSignals = buildChannelBrandSignals(stockRows, stockTargets);
  const stockTotalSummary = buildStockTotalSummary(stockRows, stockTargets);
  const stockChannelSummaries = buildStockChannelSummaries(stockRows, stockTargets);

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
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Source As Of</span>{' '}
                {formatMonth(sourceAsOfMonth)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Published Sources</span>{' '}
                {publishedCount}/5
              </span>
            </div>
            <DsoGlobalCards rows={dsoScoreRows} stockTotalSummary={stockTotalSummary} />

            <DsoDashboardPanel
              overviewRows={dsoOverviewRows}
              trendRows={dsoTrendRows}
              tableRows={dsoTableRows}
              initialGroup="Anual / General"
              stockRows={stockRows}
              stockTargets={stockTargets}
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
            <DsoGlobalCards rows={dsoScoreRows} stockTotalSummary={stockTotalSummary} />
            <DsoScorecardPanel rows={dsoScoreRows} sources={sources} channelBrandSignals={channelBrandSignals} />
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
            <DsoGlobalCards rows={dsoScoreRows} stockTotalSummary={stockTotalSummary} />
            <DsoInsightsPanel
              rows={dsoScoreRows}
              channelBrandSignals={channelBrandSignals}
              stockChannelSummaries={stockChannelSummaries}
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
