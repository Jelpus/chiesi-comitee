import 'server-only';

import type { ExecutiveCardItem } from '@/types/executive';
import { getBigQueryClient } from '@/lib/bigquery/client';
import type { SemanticStatus } from '@/lib/status/status-styles';
import { getSalesInternalBudgetDualKpis, getSalesInternalDualKpisYoY } from '@/lib/data/sales-internal';

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
  defaultOwner: string;
  detailHref: string | null;
}> = [
  {
    key: 'internal_sales',
    module: 'Internal Sales',
    defaultKpi: 'Net Sales YTD',
    defaultOwner: 'Sales Internal',
    detailHref: '/executive/sales-internal/dashboard',
  },
  {
    key: 'commercial_operations',
    module: 'Commercial Operations',
    defaultKpi: 'Pending Integration',
    defaultOwner: 'Commercial Operations',
    detailHref: null,
  },
  {
    key: 'business_excellence',
    module: 'Business Excellence',
    defaultKpi: 'Pending Integration',
    defaultOwner: 'Business Excellence',
    detailHref: null,
  },
  {
    key: 'medical',
    module: 'Medical',
    defaultKpi: 'Pending Integration',
    defaultOwner: 'Medical',
    detailHref: null,
  },
  {
    key: 'opex',
    module: 'Opex',
    defaultKpi: 'Pending Integration',
    defaultOwner: 'Opex',
    detailHref: null,
  },
  {
    key: 'human_resources',
    module: 'Human Resources',
    defaultKpi: 'Pending Integration',
    defaultOwner: 'Human Resources',
    detailHref: null,
  },
  {
    key: 'ra_quality_fv',
    module: 'RA - Quality - FV',
    defaultKpi: 'Pending Integration',
    defaultOwner: 'RA - Quality - FV',
    detailHref: null,
  },
  {
    key: 'legal_compliance',
    module: 'Legal & Compliance',
    defaultKpi: 'Pending Integration',
    defaultOwner: 'Legal & Compliance',
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
  fallback?: Pick<ExecutiveCardItem, 'module' | 'kpi' | 'owner'>,
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
    kpi: fallback?.kpi ?? 'Net Sales YTD',
    actual: toCurrency(actual),
    target: toCurrency(target),
    variance: toCurrency(variance),
    status: statusFromCoverage(coverage),
    owner: fallback?.owner ?? 'Sales Internal',
    detailHref: '/executive/sales-internal/dashboard',
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
    owner: String(row.owner_name ?? '-'),
    detailHref: null,
  }));

  const cardsByModuleKey = new Map<ExecutiveModuleKey, ExecutiveCardItem>();
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
          kpi: fallback?.kpi ?? spec.defaultKpi,
          owner: fallback?.owner ?? spec.defaultOwner,
        }),
      );
      continue;
    }

    const existing = cardsByModuleKey.get(spec.key);
    if (existing) {
      finalCards.push({
        ...existing,
        module: spec.module,
        detailHref: spec.detailHref,
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
      owner: spec.defaultOwner,
      detailHref: spec.detailHref,
    });
  }

  return finalCards;
}
