import 'server-only';

import type { ExecutiveCardItem } from '@/types/executive';
import { getBigQueryClient } from '@/lib/bigquery/client';
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
import { getMedicalMonthlyInputs } from '@/lib/data/medical-forms';
import { getReportingVersions } from '@/lib/data/versions/get-reporting-versions';

type ExecutiveModuleKey =
  | 'internal_sales'
  | 'commercial_operations'
  | 'business_excellence'
  | 'medical'
  | 'opex'
  | 'human_resources'
  | 'ra_quality_fv'
  | 'legal_compliance';

function isSalesInternalLabel(moduleName: string, kpiName: string) {
  const normalized = `${moduleName} ${kpiName}`.toLowerCase();
  return (
    normalized.includes('sales internal') ||
    normalized.includes('venta interna') ||
    normalized.includes('ventas internas')
  );
}

function toSemanticStatus(value: unknown): SemanticStatus {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'green' || normalized === 'yellow' || normalized === 'red') {
    return normalized;
  }
  return 'neutral';
}

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

function detectModuleKey(input: string): ExecutiveModuleKey | null {
  const normalized = input.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

  if (
    normalized.includes('sales internal') ||
    normalized.includes('venta interna') ||
    normalized.includes('ventas internas')
  ) {
    return 'internal_sales';
  }
  if (normalized.includes('commercial operations')) return 'commercial_operations';
  if (normalized.includes('business excellence')) return 'business_excellence';
  if (normalized.includes('medical')) return 'medical';
  if (normalized.includes('opex')) return 'opex';
  if (normalized.includes('human resources') || normalized.includes(' hr ')) return 'human_resources';
  if (
    (normalized.includes('ra') && normalized.includes('quality') && normalized.includes('fv')) ||
    normalized.includes('ra quality fv')
  ) {
    return 'ra_quality_fv';
  }
  if (normalized.includes('legal') && normalized.includes('compliance')) return 'legal_compliance';

  return null;
}

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

function parseLooseNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/[$,%\s]/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

async function getMedicalExecutiveSnapshot(
  reportingVersionId: string,
  periodMonth: string,
  fallback?: Pick<ExecutiveCardItem, 'module'>,
): Promise<ExecutiveCardItem> {
  const [targetRows, inputRows] = await Promise.all([
    getAdminTargets('medical', reportingVersionId),
    getMedicalMonthlyInputs(periodMonth),
  ]);

  const activeTargets = targetRows.filter(
    (row) => row.isActive && !row.isDeleted && (row.targetValueNumeric != null || (row.targetValueText ?? '').trim()),
  );
  const inputByKpi = new Map(inputRows.map((row) => [row.kpiName.trim().toLowerCase(), row]));

  const coverages = activeTargets.map((targetRow) => {
    const kpiKey = targetRow.kpiName.trim().toLowerCase();
    const input = inputByKpi.get(kpiKey);
    const targetValue = targetRow.targetValueNumeric ?? parseLooseNumber(targetRow.targetValueText);
    const actualValue =
      input?.resultValueNumeric ??
      parseLooseNumber(input?.resultValueText) ??
      0;
    if (targetValue == null) return null;
    if (targetValue === 0) {
      return actualValue <= 0 ? 100 : 0;
    }
    return (actualValue / targetValue) * 100;
  }).filter((value): value is number => value != null && Number.isFinite(value));

  const averageCoveragePct =
    coverages.length > 0 ? coverages.reduce((sum, value) => sum + value, 0) / coverages.length : null;
  const variancePp = averageCoveragePct == null ? null : averageCoveragePct - 100;
  const status = statusFromCoverage(averageCoveragePct == null ? null : averageCoveragePct / 100);

  return {
    module: fallback?.module ?? 'Medical',
    kpi: 'Medical KPI Coverage',
    actual: averageCoveragePct == null ? 'N/A' : `${averageCoveragePct.toFixed(1)}%`,
    target: '100.0%',
    variance: variancePp == null ? 'N/A' : toSignedPp(variancePp),
    status,
    kpiSignals: [
      {
        label: 'MD',
        coveragePct: averageCoveragePct,
        tone: toneFromCoverage(averageCoveragePct),
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

export async function getExecutiveCardsFromBigQuery(
  reportingVersionId: string
): Promise<ExecutiveCardItem[]> {
  const client = getBigQueryClient();
  const versions = await getReportingVersions();
  const selectedPeriodMonth =
    versions.find((item) => item.reportingVersionId === reportingVersionId)?.periodMonth ??
    versions[0]?.periodMonth ??
    new Date().toISOString().slice(0, 7) + '-01';

  const query = `
    SELECT
      module_name,
      kpi_name,
      actual_value,
      target_value,
      variance_vs_target,
      status_color,
      owner_name
    FROM \`chiesi-committee.chiesi_committee_mart.vw_executive_home\`
    WHERE reporting_version_id = @reportingVersionId
    ORDER BY module_name
  `;

  const [rows] = await client.query({
    query,
    params: { reportingVersionId },
  });

  const cards = (rows as Array<Record<string, unknown>>).map((row) => ({
    module: String(row.module_name ?? '-'),
    kpi: String(row.kpi_name ?? '-'),
    actual: row.actual_value?.toString() ?? '-',
    target: row.target_value?.toString() ?? '-',
    variance: row.variance_vs_target?.toString() ?? '-',
    status: toSemanticStatus(row.status_color),
    detailHref: null,
  }));

  const cardsByModuleKey = new Map<ExecutiveModuleKey, ExecutiveCardItem>();
  const detailHrefWithVersion = (href: string | null) =>
    href ? `${href}${href.includes('?') ? '&' : '?'}version=${encodeURIComponent(reportingVersionId)}` : null;
  for (const card of cards) {
    const key = detectModuleKey(`${card.module} ${card.kpi}`);
    if (!key) continue;
    if (!cardsByModuleKey.has(key)) {
      cardsByModuleKey.set(key, card);
    }
  }

  const finalCards: ExecutiveCardItem[] = [];
  for (const spec of executiveCardOrder) {
    if (spec.key === 'internal_sales') {
      const fallback = cardsByModuleKey.get(spec.key);
      finalCards.push(
        await getSalesInternalExecutiveSnapshot({
          module: spec.module,
        }),
      );
      continue;
    }

    if (spec.key === 'business_excellence') {
      const fallback = cardsByModuleKey.get(spec.key);
      const snapshot = await getBusinessExcellenceExecutiveSnapshot(reportingVersionId, {
        module: spec.module,
      });
      finalCards.push({
        ...snapshot,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    if (spec.key === 'commercial_operations') {
      const snapshot = await getCommercialOperationsExecutiveSnapshot(reportingVersionId, {
        module: spec.module,
      });
      finalCards.push({
        ...snapshot,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    if (spec.key === 'human_resources') {
      const snapshot = await getHumanResourcesExecutiveSnapshot(reportingVersionId, {
        module: spec.module,
      });
      finalCards.push({
        ...snapshot,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    if (spec.key === 'opex') {
      const snapshot = await getOpexExecutiveSnapshot(reportingVersionId, {
        module: spec.module,
      });
      finalCards.push({
        ...snapshot,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    if (spec.key === 'medical') {
      const snapshot = await getMedicalExecutiveSnapshot(
        reportingVersionId,
        selectedPeriodMonth,
        { module: spec.module },
      );
      finalCards.push({
        ...snapshot,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    if (spec.key === 'ra_quality_fv') {
      const snapshot = await getRaQualityFvExecutiveSnapshot(
        reportingVersionId,
        selectedPeriodMonth,
        { module: spec.module },
      );
      finalCards.push({
        ...snapshot,
        detailHref: detailHrefWithVersion(spec.detailHref),
      });
      continue;
    }

    if (spec.key === 'legal_compliance') {
      const snapshot = await getLegalComplianceExecutiveSnapshot(
        reportingVersionId,
        selectedPeriodMonth,
        { module: spec.module },
      );
      finalCards.push({
        ...snapshot,
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
