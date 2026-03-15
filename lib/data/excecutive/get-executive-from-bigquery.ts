import 'server-only';

import type { ExecutiveCardItem } from '@/types/executive';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type { SemanticStatus } from '@/lib/status/status-styles';
import { getSalesInternalBudgetDualKpis, getSalesInternalDualKpisYoY } from '@/lib/data/sales-internal';
import { getBusinessExcellenceBusinessUnitChannelRows } from '@/lib/data/business-excellence';
import { getHumanResourcesTrainingThemeData, getHumanResourcesTurnoverThemeData } from '@/lib/data/human-resources';

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
    defaultKpi: 'Pending Integration',
    detailHref: null,
  },
  {
    key: 'opex',
    module: 'Opex',
    defaultKpi: 'Pending Integration',
    detailHref: null,
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
    detailHref: null,
  },
  {
    key: 'legal_compliance',
    module: 'Legal & Compliance',
    defaultKpi: 'Pending Integration',
    detailHref: null,
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
    kpi: 'Sell In',
    actual: toCurrency(actual),
    target: toCurrency(target),
    variance: toCurrency(variance),
    status: statusFromCoverage(coverage),
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
    kpi: 'Sell OUT',
    actual: toUnits(actual),
    target: toUnits(target),
    variance: toSignedUnits(variance),
    status: statusFromCoverage(coverage),
    detailHref: '/executive/business-excellence/insights',
  };
}

function toSignedPp(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(1)}pp`;
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
    kpi: 'TurnOver & Training',
    actual: `TOV ${toUnits(turnoverActual)} | TRN ${(trainingActualCoverage * 100).toFixed(1)}%`,
    target: `TOV ${toUnits(turnoverTarget)} | TRN ${(trainingTargetCoverage * 100).toFixed(0)}%`,
    variance: `TOV ${toSignedUnits(turnoverVariance)} | TRN ${toSignedPp(trainingCoverageVariancePp)}`,
    status,
    detailHref: '/executive/human-resources/insights',
  };
}

export async function getExecutiveCardsFromBigQuery(
  reportingVersionId: string
): Promise<ExecutiveCardItem[]> {
  const client = getBigQueryClient();

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
