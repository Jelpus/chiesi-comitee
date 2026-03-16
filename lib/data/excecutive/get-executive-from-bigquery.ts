import 'server-only';
import { unstable_cache } from 'next/cache';

import type { ExecutiveCardItem } from '@/types/executive';
import type { SemanticStatus } from '@/lib/status/status-styles';
import { getSalesInternalBudgetDualKpis, getSalesInternalDualKpisYoY } from '@/lib/data/sales-internal';
import { getBusinessExcellenceBusinessUnitChannelRows } from '@/lib/data/business-excellence';
import { getHumanResourcesTrainingThemeData, getHumanResourcesTurnoverThemeData } from '@/lib/data/human-resources';
import {
  getCommercialOperationsDeliveryOrderRows,
  getCommercialOperationsStocksRows,
} from '@/lib/data/commercial-operations';
import { getAdminTargets } from '@/lib/data/targets';
import { getOpexRows } from '@/lib/data/opex';
import { getRaQualityFvData } from '@/lib/data/ra-quality-fv';
import { getLegalComplianceData } from '@/lib/data/legal-compliance';
import { getMedicalData } from '@/lib/data/medical';

type ExecutiveModuleKey =
  | 'internal_sales'
  | 'commercial_operations'
  | 'business_excellence'
  | 'medical'
  | 'opex'
  | 'human_resources'
  | 'ra_quality_fv'
  | 'legal_compliance';

const executiveCardOrder: Array<{
  key: ExecutiveModuleKey;
  module: string;
  defaultKpi: string;
  detailHref: string | null;
}> = [
  {
    key: 'internal_sales',
    module: 'Internal Sales',
    defaultKpi: 'Sell In',
    detailHref: '/executive/sales-internal/insights',
  },
  {
    key: 'commercial_operations',
    module: 'Commercial Operations',
    defaultKpi: 'Pending Integration',
    detailHref: '/executive/commercial-operations/insights',
  },
  {
    key: 'business_excellence',
    module: 'Business Excellence',
    defaultKpi: 'Sell OUT',
    detailHref: '/executive/business-excellence/insights',
  },
  {
    key: 'medical',
    module: 'Medical',
    defaultKpi: 'Medical KPI Coverage',
    detailHref: '/executive/medical',
  },
  {
    key: 'opex',
    module: 'Opex',
    defaultKpi: 'Total Market Co Expenses',
    detailHref: '/executive/opex/insights',
  },
  {
    key: 'human_resources',
    module: 'Human Resources',
    defaultKpi: 'Pending Integration',
    detailHref: '/executive/human-resources/insights',
  },
  {
    key: 'ra_quality_fv',
    module: 'RA - Quality - FV',
    defaultKpi: 'Pending Integration',
    detailHref: '/executive/ra-quality-fv/insights',
  },
  {
    key: 'legal_compliance',
    module: 'Legal & Compliance',
    defaultKpi: 'Pending Integration',
    detailHref: '/executive/legal-compliance/insights',
  },
];

function toCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusFromCoverage(coverage: number | null): SemanticStatus {
  if (coverage === null) return 'neutral';
  if (coverage >= 1) return 'green';
  if (coverage >= 0.95) return 'yellow';
  return 'red';
}

async function getSalesInternalExecutiveSnapshot(
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const [dualKpisYoY, budgetDualKpis] = await Promise.all([
    getSalesInternalDualKpisYoY({}),
    getSalesInternalBudgetDualKpis({}),
  ]);

  const actual = dualKpisYoY.netSales.actual;
  const target = budgetDualKpis.netSales.budget;
  const variance = actual - target;
  const coverage = target === 0 ? null : actual / target;

  return {
    module: fallback?.module ?? 'Internal Sales',
    kpi: 'Sell In by Net Sales',
    actual: toCurrency(actual),
    target: toCurrency(target),
    variance: toCurrency(variance),
    status: statusFromCoverage(coverage),
    kpiSignals: [
      {
        label: 'NET',
        coveragePct: coverage == null ? null : coverage * 100,
        tone: toneFromCoverage(coverage == null ? null : coverage * 100),
      },
    ],
    detailHref: '/executive/sales-internal/insights',
  };
}

function toUnits(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function toSignedUnits(value: number) {
  const formatted = toUnits(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

async function getBusinessExcellenceExecutiveSnapshot(
  reportingVersionId: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const rows = await getBusinessExcellenceBusinessUnitChannelRows(reportingVersionId);
  const targetUnits = new Set(['air', 'care']);
  const scopedRows = rows.filter((row) => targetUnits.has(row.businessUnitName.trim().toLowerCase()));
  const actual = scopedRows.reduce((sum, row) => sum + row.totalYtdUnits, 0);
  const target = scopedRows.reduce((sum, row) => sum + row.totalYtdBudgetUnits, 0);
  const variance = actual - target;
  const coverage = target === 0 ? null : actual / target;

  return {
    module: fallback?.module ?? 'Business Excellence',
    kpi: 'Sell Out by Units',
    actual: toUnits(actual),
    target: toUnits(target),
    variance: toSignedUnits(variance),
    status: statusFromCoverage(coverage),
    kpiSignals: [
      {
        label: 'UNITS',
        coveragePct: coverage == null ? null : coverage * 100,
        tone: toneFromCoverage(coverage == null ? null : coverage * 100),
      },
    ],
    detailHref: '/executive/business-excellence/insights',
  };
}

function toSignedPp(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(1)}pp`;
}

function toSignedDays(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(1)}d`;
}

function toSignedPctPoint(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(1)}pp`;
}

function toneFromCoverage(coveragePct: number | null): 'green' | 'light-green' | 'yellow' | 'red' | 'neutral' {
  if (coveragePct == null || !Number.isFinite(coveragePct)) return 'neutral';
  if (coveragePct >= 100) return 'green';
  if (coveragePct >= 98) return 'light-green';
  if (coveragePct >= 90) return 'yellow';
  return 'red';
}

async function getMedicalExecutiveSnapshot(
  reportingVersionId: string,
  periodMonth: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const data = await getMedicalData(reportingVersionId, periodMonth);
  const total = data.summary.totalKpis;
  const onTrack = data.summary.onTrack;
  const offTrack = data.summary.offTrack;
  const healthScorePct = data.summary.healthScorePct;
  const status = statusFromCoverage(healthScorePct == null ? null : healthScorePct / 100);

  return {
    module: fallback?.module ?? 'Medical',
    kpi: 'Medical KPIs On Track',
    actual: total > 0 ? `${onTrack}/${total}` : 'N/A',
    target: total > 0 ? `${total}/${total}` : 'N/A',
    variance: total > 0 ? `${offTrack} gaps` : 'N/A',
    status,
    kpiSignals: [
      {
        label: 'MD',
        coveragePct: healthScorePct,
        tone: toneFromCoverage(healthScorePct),
      },
    ],
    detailHref: '/executive/medical',
  };
}

function getCommercialOperationsTargetValue(
  targetRows: Awaited<ReturnType<typeof getAdminTargets>>,
  pattern: RegExp,
): number | null {
  const normalize = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
  const row = targetRows.find(
    (item) => item.isActive && pattern.test(normalize(item.kpiName ?? '')),
  );
  return row?.targetValueNumeric ?? null;
}

async function getCommercialOperationsExecutiveSnapshot(
  reportingVersionId: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const [stockRows, deliveryRows, targetRows] = await Promise.all([
    getCommercialOperationsStocksRows(reportingVersionId),
    getCommercialOperationsDeliveryOrderRows(reportingVersionId),
    getAdminTargets('commercial_operations', reportingVersionId),
  ]);

  const dohTarget = getCommercialOperationsTargetValue(targetRows, /^doh\s+total\s+chiesi$/i);
  const fillRateGovTarget = getCommercialOperationsTargetValue(targetRows, /^fill\s*rate\s+gobierno$/i);
  const fillRatePrivateTarget = getCommercialOperationsTargetValue(targetRows, /^fill\s*rate\s+privado$/i);
  const leadGovTarget = getCommercialOperationsTargetValue(targetRows, /^lead\s*time\s+gobierno$/i);
  const leadPrivateTarget = getCommercialOperationsTargetValue(targetRows, /^lead\s*time\s+privado$/i);

  const stockByPeriod = new Map<string, { stock: number; sellOut: number; isMth: boolean }>();
  for (const row of stockRows) {
    const type = (row.stockType ?? '').toLowerCase();
    const isStock = type.includes('stock');
    const isSellOut = type.includes('sell out') || type.includes('sellout');
    if (!isStock && !isSellOut) continue;
    const current = stockByPeriod.get(row.periodMonth) ?? { stock: 0, sellOut: 0, isMth: false };
    if (isStock) current.stock += row.stockValue;
    if (isSellOut) current.sellOut += row.stockValue;
    current.isMth = current.isMth || row.isMth;
    stockByPeriod.set(row.periodMonth, current);
  }
  const stockSeries = [...stockByPeriod.entries()].map(([periodMonth, value]) => ({
    periodMonth,
    doh: value.sellOut > 0 ? (value.stock / value.sellOut) * 30 : null,
    isMth: value.isMth,
  }));
  const dohCurrent =
    stockSeries.find((item) => item.isMth)?.doh ??
    stockSeries.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth)).at(-1)?.doh ??
    null;
  const dohVariance =
    dohCurrent != null && dohTarget != null ? dohCurrent - dohTarget : null;

  const availableScopes = new Set(
    deliveryRows
      .map((row) => (row.orderScope ?? '').toLowerCase().trim())
      .filter((scope) => scope === 'government' || scope === 'private'),
  );
  const hasGovernment = availableScopes.has('government');
  const hasPrivate = availableScopes.has('private');
  const selectedScope: 'government' | 'private' | 'total' =
    hasGovernment && hasPrivate ? 'total' : hasPrivate ? 'private' : 'government';

  const deliveryScoped = deliveryRows.filter((row) => {
    const scope = (row.orderScope ?? '').toLowerCase().trim();
    if (selectedScope === 'total') return scope === 'government' || scope === 'private';
    return scope === selectedScope;
  });
  const sourceAsOf = deliveryScoped
    .map((row) => row.sourceAsOfMonth)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const bounded = sourceAsOf
    ? deliveryScoped.filter((row) => row.periodMonth <= sourceAsOf)
    : deliveryScoped;
  const ytdRows = bounded.filter((row) => row.isYtd);
  const ytdRequested = ytdRows.reduce((sum, row) => sum + row.cantidadTotalPedido, 0);
  const ytdDelivered = ytdRows.reduce((sum, row) => sum + row.cantidadEntregada, 0);
  const fillRateCurrent = ytdRequested > 0 ? (ytdDelivered / ytdRequested) * 100 : null;
  const leadValues = ytdRows
    .map((row) => row.leadTimeDays)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const leadCurrent =
    leadValues.length > 0 ? leadValues.reduce((a, b) => a + b, 0) / leadValues.length : null;

  const fillRateTarget =
    selectedScope === 'government'
      ? fillRateGovTarget
      : selectedScope === 'private'
        ? fillRatePrivateTarget
        : null;
  const leadTarget =
    selectedScope === 'government'
      ? leadGovTarget
      : selectedScope === 'private'
        ? leadPrivateTarget
        : null;

  const fillRateVariance =
    fillRateCurrent != null && fillRateTarget != null ? fillRateCurrent - fillRateTarget : null;
  const leadVariance =
    leadCurrent != null && leadTarget != null ? leadCurrent - leadTarget : null;
  const dohCoveragePct = dohCurrent != null && dohTarget != null && dohCurrent > 0 ? (dohTarget / dohCurrent) * 100 : null;
  const fillRateCoveragePct =
    fillRateCurrent != null && fillRateTarget != null && fillRateTarget > 0
      ? (fillRateCurrent / fillRateTarget) * 100
      : null;

  const signals = [
    dohVariance != null ? dohVariance <= 0 : null,
    fillRateVariance != null ? fillRateVariance >= 0 : null,
    leadVariance != null ? leadVariance <= 0 : null,
  ].filter((value): value is boolean => value != null);
  const status: SemanticStatus =
    signals.length === 0
      ? 'neutral'
      : signals.every(Boolean)
        ? 'green'
        : signals.some((value) => value === false) && signals.some((value) => value === true)
          ? 'yellow'
          : 'red';

  return {
    module: fallback?.module ?? 'Commercial Operations',
    kpi: 'Days on Hand & Fill Rate',
    actual: `DOH ${dohCurrent == null ? 'N/A' : dohCurrent.toFixed(1)}d | FR ${fillRateCurrent == null ? 'N/A' : `${fillRateCurrent.toFixed(1)}%`}`,
    target: `DOH ${dohTarget == null ? 'N/A' : `${dohTarget.toFixed(1)}d`} | FR ${fillRateTarget == null ? 'N/A' : `${fillRateTarget.toFixed(1)}%`}`,
    variance: `DOH ${dohVariance == null ? 'N/A' : toSignedDays(dohVariance)} | FR ${fillRateVariance == null ? 'N/A' : toSignedPctPoint(fillRateVariance)}`,
    status,
    kpiSignals: [
      { label: 'DOH', coveragePct: dohCoveragePct, tone: toneFromCoverage(dohCoveragePct) },
      { label: 'FR', coveragePct: fillRateCoveragePct, tone: toneFromCoverage(fillRateCoveragePct) },
    ],
    detailHref: '/executive/commercial-operations/insights',
  };
}

async function getHumanResourcesExecutiveSnapshot(
  reportingVersionId: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const [turnover, training] = await Promise.all([
    getHumanResourcesTurnoverThemeData(reportingVersionId, 'total'),
    getHumanResourcesTrainingThemeData(reportingVersionId, 'total'),
  ]);

  const turnoverActual = turnover?.summary.currentYtdExits ?? 0;
  const turnoverTarget = turnover?.summary.targetYtdExits ?? 0;
  const turnoverVariance = turnoverActual - turnoverTarget;

  const trainingActualCoverage = training?.summary.coverageRateYtd ?? 0;
  const trainingTargetCoverage = 0.85;
  const trainingCoverageVariancePp = (trainingActualCoverage - trainingTargetCoverage) * 100;
  const trainingCoveragePct =
    trainingTargetCoverage > 0 ? (trainingActualCoverage / trainingTargetCoverage) * 100 : null;
  const turnoverCoveragePct =
    turnoverTarget <= 0
      ? turnoverActual <= 0
        ? 100
        : 0
      : (turnoverTarget / Math.max(turnoverActual, 1)) * 100;

  const turnoverStatus = turnoverVariance <= 0 ? 'green' : turnoverVariance <= 2 ? 'yellow' : 'red';
  const trainingStatus =
    trainingActualCoverage >= 0.85 ? 'green' : trainingActualCoverage >= 0.75 ? 'yellow' : 'red';
  const status: SemanticStatus =
    turnoverStatus === 'red' || trainingStatus === 'red'
      ? 'red'
      : turnoverStatus === 'yellow' || trainingStatus === 'yellow'
        ? 'yellow'
        : 'green';

  return {
    module: fallback?.module ?? 'Human Resources',
    kpi: 'Turnover & Training',
    actual: `TOV ${toUnits(turnoverActual)} | TRN ${(trainingActualCoverage * 100).toFixed(1)}%`,
    target: `TOV ${toUnits(turnoverTarget)} | TRN ${(trainingTargetCoverage * 100).toFixed(0)}%`,
    variance: `TOV ${toSignedUnits(turnoverVariance)} | TRN ${toSignedPp(trainingCoverageVariancePp)}`,
    status,
    kpiSignals: [
      {
        label: 'TOV',
        coveragePct: turnoverCoveragePct,
        tone: toneFromCoverage(turnoverCoveragePct),
      },
      {
        label: 'TRN',
        coveragePct: trainingCoveragePct,
        tone: toneFromCoverage(trainingCoveragePct),
      },
    ],
    detailHref: '/executive/human-resources/insights',
  };
}

function getMetricYear(metricName: string): number | null {
  const match = metricName.match(/(\d{4})$/);
  if (!match) return null;
  return Number(match[1]);
}

function resolveOpexMetricMap(rows: Awaited<ReturnType<typeof getOpexRows>>) {
  const metrics = [...new Set(rows.map((row) => row.metricName))];
  const actualMetrics = metrics.filter((metric) => metric.startsWith('actuals_'));
  const budgetMetrics = metrics.filter((metric) => metric.startsWith('budget_'));
  const sortedActual = actualMetrics
    .map((metric) => ({ metric, year: getMetricYear(metric) ?? -1 }))
    .sort((a, b) => b.year - a.year);
  const currentActual = sortedActual[0]?.metric ?? null;
  const currentYear = getMetricYear(currentActual ?? '');
  const currentBudget = budgetMetrics.find((metric) => getMetricYear(metric) === currentYear) ?? null;
  return { currentActual, currentBudget };
}

async function getOpexExecutiveSnapshot(
  reportingVersionId: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const rows = await getOpexRows(reportingVersionId);
  const { currentActual, currentBudget } = resolveOpexMetricMap(rows);

  let ytdActual = 0;
  let ytdBudget = 0;
  for (const row of rows) {
    if (currentActual && row.metricName === currentActual && row.isYtd) {
      ytdActual += row.amountValue;
    }
    if (currentBudget && row.metricName === currentBudget && row.isYtd) {
      ytdBudget += row.amountValue;
    }
  }

  const variance = ytdActual - ytdBudget;
  const coverage = ytdBudget > 0 ? ytdActual / ytdBudget : null;
  const coveragePct = coverage == null ? null : coverage * 100;

  return {
    module: fallback?.module ?? 'Opex',
    kpi: 'Total Expenses by CC',
    actual: coveragePct == null ? 'N/A' : `${coveragePct.toFixed(1)}%`,
    target: toCurrency(ytdBudget),
    variance: toCurrency(variance),
    status: statusFromCoverage(coverage),
    kpiSignals: [
      {
        label: 'YTD',
        coveragePct,
        tone: toneFromCoverage(coveragePct),
      },
    ],
    detailHref: '/executive/opex/insights',
  };
}

async function getRaQualityFvExecutiveSnapshot(
  reportingVersionId: string,
  periodMonth: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const data = await getRaQualityFvData(reportingVersionId, periodMonth);
  const total = data.summary.totalTopics;
  const onTrack = data.summary.onTrack;
  const offTrack = data.summary.offTrack;
  const coveragePct = total > 0 ? (onTrack / total) * 100 : null;

  return {
    module: fallback?.module ?? 'RA - Quality - FV',
    kpi: 'Regulatory Topics On Track',
    actual: total > 0 ? `${onTrack}/${total}` : 'N/A',
    target: total > 0 ? `${total}/${total}` : 'N/A',
    variance: total > 0 ? `${offTrack} off track` : 'N/A',
    status: statusFromCoverage(coveragePct == null ? null : coveragePct / 100),
    kpiSignals: [
      {
        label: 'RA',
        coveragePct,
        tone: toneFromCoverage(coveragePct),
      },
    ],
    detailHref: '/executive/ra-quality-fv/insights',
  };
}

async function getLegalComplianceExecutiveSnapshot(
  reportingVersionId: string,
  periodMonth: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const data = await getLegalComplianceData(reportingVersionId, periodMonth);
  const total = data.summary.totalKpis;
  const onTrack = data.summary.onTrack;
  const offTrack = data.summary.offTrack;
  const healthCoverage = data.summary.weightedHealthPct == null ? null : data.summary.weightedHealthPct / 100;

  return {
    module: fallback?.module ?? 'Legal & Compliance',
    kpi: 'Legal Topics On Track',
    actual: total > 0 ? `${onTrack}/${total}` : 'N/A',
    target: total > 0 ? `${total}/${total}` : 'N/A',
    variance: total > 0 ? `${offTrack} gaps` : 'N/A',
    status: statusFromCoverage(healthCoverage),
    kpiSignals: [
      {
        label: 'LC',
        coveragePct: data.summary.weightedHealthPct,
        tone: toneFromCoverage(data.summary.weightedHealthPct),
      },
    ],
    detailHref: '/executive/legal-compliance/insights',
  };
}

const getSalesInternalExecutiveSnapshotCached = unstable_cache(
  async () => getSalesInternalExecutiveSnapshot({ module: 'Internal Sales' }),
  ['executive-home', 'snapshot', 'internal-sales'],
  { revalidate: 120, tags: ['executive-home'] },
);

const getBusinessExcellenceExecutiveSnapshotCached = unstable_cache(
  async (reportingVersionId: string) =>
    getBusinessExcellenceExecutiveSnapshot(reportingVersionId, { module: 'Business Excellence' }),
  ['executive-home', 'snapshot', 'business-excellence'],
  { revalidate: 120, tags: ['executive-home'] },
);

const getCommercialOperationsExecutiveSnapshotCached = unstable_cache(
  async (reportingVersionId: string) =>
    getCommercialOperationsExecutiveSnapshot(reportingVersionId, { module: 'Commercial Operations' }),
  ['executive-home', 'snapshot', 'commercial-operations'],
  { revalidate: 120, tags: ['executive-home'] },
);

const getMedicalExecutiveSnapshotCached = unstable_cache(
  async (reportingVersionId: string, periodMonth: string) =>
    getMedicalExecutiveSnapshot(reportingVersionId, periodMonth, { module: 'Medical' }),
  ['executive-home', 'snapshot', 'medical'],
  { revalidate: 120, tags: ['executive-home'] },
);

const getOpexExecutiveSnapshotCached = unstable_cache(
  async (reportingVersionId: string) =>
    getOpexExecutiveSnapshot(reportingVersionId, { module: 'Opex' }),
  ['executive-home', 'snapshot', 'opex'],
  { revalidate: 120, tags: ['executive-home'] },
);

const getHumanResourcesExecutiveSnapshotCached = unstable_cache(
  async (reportingVersionId: string) =>
    getHumanResourcesExecutiveSnapshot(reportingVersionId, { module: 'Human Resources' }),
  ['executive-home', 'snapshot', 'human-resources'],
  { revalidate: 120, tags: ['executive-home'] },
);

const getRaQualityFvExecutiveSnapshotCached = unstable_cache(
  async (reportingVersionId: string, periodMonth: string) =>
    getRaQualityFvExecutiveSnapshot(reportingVersionId, periodMonth, { module: 'RA - Quality - FV' }),
  ['executive-home', 'snapshot', 'ra-quality-fv'],
  { revalidate: 120, tags: ['executive-home'] },
);

const getLegalComplianceExecutiveSnapshotCached = unstable_cache(
  async (reportingVersionId: string, periodMonth: string) =>
    getLegalComplianceExecutiveSnapshot(reportingVersionId, periodMonth, { module: 'Legal & Compliance' }),
  ['executive-home', 'snapshot', 'legal-compliance'],
  { revalidate: 120, tags: ['executive-home'] },
);

export async function getExecutiveCardsFromBigQuery(
  reportingVersionId: string,
  selectedPeriodMonth: string,
): Promise<ExecutiveCardItem[]> {
  const cardsByModuleKey = new Map<ExecutiveModuleKey, ExecutiveCardItem>();
  const detailHrefWithVersion = (href: string | null) =>
    href ? `${href}${href.includes('?') ? '&' : '?'}version=${encodeURIComponent(reportingVersionId)}` : null;

  const snapshotPromises: Record<ExecutiveModuleKey, Promise<ExecutiveCardItem> | null> = {
    internal_sales: getSalesInternalExecutiveSnapshotCached(),
    commercial_operations: getCommercialOperationsExecutiveSnapshotCached(reportingVersionId),
    business_excellence: getBusinessExcellenceExecutiveSnapshotCached(reportingVersionId),
    medical: getMedicalExecutiveSnapshotCached(reportingVersionId, selectedPeriodMonth),
    opex: getOpexExecutiveSnapshotCached(reportingVersionId),
    human_resources: getHumanResourcesExecutiveSnapshotCached(reportingVersionId),
    ra_quality_fv: getRaQualityFvExecutiveSnapshotCached(reportingVersionId, selectedPeriodMonth),
    legal_compliance: getLegalComplianceExecutiveSnapshotCached(reportingVersionId, selectedPeriodMonth),
  };

  const finalCards: ExecutiveCardItem[] = [];
  for (const spec of executiveCardOrder) {
    const promise = snapshotPromises[spec.key];
    if (promise) {
      const snapshot = await promise;
      finalCards.push({
        ...snapshot,
        module: spec.module,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    const existing = cardsByModuleKey.get(spec.key);
    if (existing) {
      finalCards.push({
        ...existing,
        module: spec.module,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    finalCards.push({
      module: spec.module,
      kpi: spec.defaultKpi,
      actual: '-',
      target: '-',
      variance: '-',
      status: 'neutral',
      detailHref: detailHrefWithVersion(spec.detailHref),
    });
  }

  return finalCards;
}
